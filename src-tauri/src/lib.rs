use fs2::available_space;
use serde::{Deserialize, Serialize};
use std::{
  fs,
  io::{Read, Write},
  path::{Path, PathBuf},
  process::{Command, Stdio},
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
  },
  thread,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use url::Url;

mod document;

#[derive(Default)]
struct AppState {
  job: Mutex<Option<Arc<JobControl>>>,
}

struct JobControl {
  job_id: String,
  cancelled: AtomicBool,
  paused: AtomicBool,
  notify_enabled: bool,
  child_id: Mutex<Option<u32>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpandPayload {
  paths: Vec<String>,
  mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InspectPayload {
  files: Vec<String>,
  output_directory: Option<String>,
  mode: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct ToolOptions {
  preset_key: Option<String>,
  proxy_size: Option<String>,
  video_format: Option<String>,
  audio_format: Option<String>,
  width: Option<String>,
  fps: Option<String>,
  timestamp: Option<String>,
  subtitle_path: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StartPayload {
  tool_id: String,
  mode: Option<String>,
  files: Vec<String>,
  output_directory: String,
  options: Option<ToolOptions>,
  notify_enabled: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ValidationResult {
  ok: bool,
  message: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ToolResult {
  source_file: String,
  output_file: String,
  output_url: String,
  input_size: u64,
  output_size: u64,
  input_size_text: String,
  output_size_text: String,
  saved_bytes: i64,
  saved_text: String,
  saved_percent: i64,
  validation: ValidationResult,
  preview_type: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileError {
  source_file: String,
  message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BasicResponse {
  ok: bool,
  message: Option<String>,
  job_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InspectResult {
  files: Vec<String>,
  total_input_bytes: u64,
  total_input_text: String,
  free_bytes: Option<u64>,
  free_text: String,
  low_disk: bool,
  minimum_recommended_text: String,
}

fn extensions_for_mode(mode: &str) -> &'static [&'static str] {
  match mode {
    "audio" => &["wav", "mp3", "aac", "m4a", "flac", "ogg", "mp4", "mov", "mkv", "avi", "webm", "m4v"],
    "document" => &["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
    _ => &["mp4", "mov", "mkv", "avi", "mts", "m2ts", "webm", "m4v"],
  }
}

fn is_allowed(path: &Path, mode: &str) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| extensions_for_mode(mode).contains(&ext.to_lowercase().as_str()))
    .unwrap_or(false)
}

fn scan_dir(dir: &Path, mode: &str, out: &mut Vec<String>) {
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        scan_dir(&path, mode, out);
      } else if path.is_file() && is_allowed(&path, mode) {
        out.push(path.to_string_lossy().to_string());
      }
    }
  }
}

fn expand_paths(paths: &[String], mode: &str) -> Vec<String> {
  let mut out = Vec::new();
  for item in paths {
    let path = PathBuf::from(item);
    if path.is_dir() {
      scan_dir(&path, mode, &mut out);
    } else if path.is_file() && is_allowed(&path, mode) {
      out.push(path.to_string_lossy().to_string());
    }
  }
  out.sort();
  out.dedup();
  out
}

fn format_size(bytes: u64) -> String {
  if bytes == 0 {
    return "0 B".into();
  }
  let units = ["B", "KB", "MB", "GB", "TB"];
  let mut value = bytes as f64;
  let mut index = 0;
  while value >= 1024.0 && index < units.len() - 1 {
    value /= 1024.0;
    index += 1;
  }
  format!("{:.1} {}", value, units[index])
}

fn now_id() -> String {
  SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis().to_string()
}

fn tool_path(app: &AppHandle, name: &str) -> String {
  let file = if cfg!(windows) { format!("{}.exe", name) } else { name.to_string() };
  if let Ok(resource_dir) = app.path().resource_dir() {
    let candidate = resource_dir.join("resources").join("ffmpeg").join("win32-x64").join(&file);
    if candidate.exists() {
      return candidate.to_string_lossy().to_string();
    }
    let candidate = resource_dir.join("ffmpeg").join("win32-x64").join(&file);
    if candidate.exists() {
      return candidate.to_string_lossy().to_string();
    }
  }
  let dev = PathBuf::from("resources").join("ffmpeg").join("win32-x64").join(&file);
  if dev.exists() {
    return dev.to_string_lossy().to_string();
  }
  file
}

fn run_command(command: &str, args: &[&str]) -> Result<String, String> {
  let output = Command::new(command).args(args).output().map_err(|err| err.to_string())?;
  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

fn duration(app: &AppHandle, file: &str) -> f64 {
  run_command(&tool_path(app, "ffprobe"), &["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file])
    .ok()
    .and_then(|out| out.trim().parse::<f64>().ok())
    .unwrap_or(0.0)
}

fn parse_time(text: &str) -> Option<f64> {
  let pos = text.rfind("time=")?;
  let raw = text.get(pos + 5..)?.split_whitespace().next()?;
  let parts: Vec<&str> = raw.split(':').collect();
  if parts.len() != 3 { return None; }
  Some(parts[0].parse::<f64>().ok()? * 3600.0 + parts[1].parse::<f64>().ok()? * 60.0 + parts[2].parse::<f64>().ok()?)
}

fn parse_speed(text: &str) -> Option<f64> {
  let pos = text.rfind("speed=")?;
  let raw = text.get(pos + 6..)?.split_whitespace().next()?.trim_end_matches('x');
  raw.parse::<f64>().ok()
}

fn safe_output(source: &str, out_dir: &str, ext: &str) -> String {
  let source_path = PathBuf::from(source);
  let stem = source_path.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
  let mut candidate = PathBuf::from(out_dir).join(format!("{}-cardvault{}", stem, ext));
  let mut index = 2;
  while candidate.exists() {
    candidate = PathBuf::from(out_dir).join(format!("{}-cardvault-{}{}", stem, index, ext));
    index += 1;
  }
  candidate.to_string_lossy().to_string()
}

fn validate_output(app: &AppHandle, output: &str, source_duration: f64, preview_type: &str) -> ValidationResult {
  let Ok(meta) = fs::metadata(output) else { return ValidationResult { ok: false, message: "Output not found.".into() }; };
  if meta.len() == 0 { return ValidationResult { ok: false, message: "Output is empty.".into() }; }
  if preview_type == "video" || preview_type == "audio" {
    let output_duration = duration(app, output);
    if source_duration > 0.0 && output_duration > 0.0 {
      let drift = (source_duration - output_duration).abs();
      if drift > source_duration.mul_add(0.03, 2.0).max(2.0) {
        return ValidationResult { ok: false, message: "Duration drift is too large.".into() };
      }
    }
  }
  ValidationResult { ok: true, message: "Validated.".into() }
}

fn file_url(path: &str) -> String {
  Url::from_file_path(path).map(|url| url.to_string()).unwrap_or_default()
}

fn build_args(tool_id: &str, source: &str, output_dir: &str, options: &ToolOptions) -> Result<(String, String, Vec<String>), String> {
  let common = vec!["-hide_banner".into(), "-nostdin".into(), "-y".into(), "-i".into(), source.into()];
  let preset = options.preset_key.clone().unwrap_or_else(|| "balanced".into());
  let (crf, speed) = match preset.as_str() { "high" => ("18", "medium"), "small" => ("26", "faster"), _ => ("22", "fast") };
  let mut args = common;
  match tool_id {
    "compress-video" => {
      let output = safe_output(source, output_dir, ".mp4");
      args.extend(["-map_metadata", "0", "-c:v", "libx265", "-preset", speed, "-crf", crf, "-threads", "0", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    "proxy-generator" => {
      let size = options.proxy_size.clone().unwrap_or_else(|| "1080".into());
      let output = safe_output(source, output_dir, ".mp4");
      args.extend(["-vf", &format!("scale=-2:{}", size), "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "128k", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    "convert-video" => {
      let fmt = options.video_format.clone().unwrap_or_else(|| "mp4".into());
      let output = safe_output(source, output_dir, &format!(".{}", fmt));
      args.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    "extract-audio" => {
      let fmt = options.audio_format.clone().unwrap_or_else(|| "mp3".into());
      let output = safe_output(source, output_dir, &format!(".{}", fmt));
      args.push("-vn".into());
      if fmt == "wav" { args.extend(["-c:a", "pcm_s16le"].into_iter().map(String::from)); }
      else if fmt == "aac" { args.extend(["-c:a", "aac", "-b:a", "192k"].into_iter().map(String::from)); }
      else { args.extend(["-c:a", "libmp3lame", "-q:a", "2"].into_iter().map(String::from)); }
      args.push(output.clone());
      Ok((output, "audio".into(), args))
    }
    "generate-thumbnail" => {
      let ts = options.timestamp.clone().unwrap_or_else(|| "00:00:03".into());
      let output = safe_output(source, output_dir, ".jpg");
      args = vec!["-hide_banner".into(), "-nostdin".into(), "-y".into(), "-ss".into(), ts, "-i".into(), source.into(), "-frames:v".into(), "1".into(), "-q:v".into(), "2".into(), output.clone()];
      Ok((output, "image".into(), args))
    }
    "resize-video" => {
      let width = options.width.clone().unwrap_or_else(|| "1920".into());
      let output = safe_output(source, output_dir, ".mp4");
      args.extend(["-vf", &format!("scale={}:-2", width), "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    "change-fps" => {
      let fps = options.fps.clone().unwrap_or_else(|| "30".into());
      let output = safe_output(source, output_dir, ".mp4");
      args.extend(["-filter:v", &format!("fps={}", fps), "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    "remove-audio" => {
      let output = safe_output(source, output_dir, ".mp4");
      args.extend(["-c:v", "copy", "-an", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    "burn-subtitle" => {
      let subtitle = options.subtitle_path.clone().filter(|s| !s.is_empty()).ok_or("Choose subtitle first.")?;
      let filter = format!("subtitles='{}'", subtitle.replace('\\', "/").replace(':', "\\:"));
      let output = safe_output(source, output_dir, ".mp4");
      args.extend(["-vf", &filter, "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", &output].into_iter().map(String::from));
      Ok((output, "video".into(), args))
    }
    _ => Err(format!("Unsupported tool: {}", tool_id)),
  }
}

fn run_process(control: &Arc<JobControl>, command: &str, args: &[String], on_chunk: &mut dyn FnMut(&str)) -> Result<(), String> {
  let mut child = Command::new(command).args(args).stderr(Stdio::piped()).stdout(Stdio::piped()).spawn().map_err(|e| e.to_string())?;
  *control.child_id.lock().unwrap() = Some(child.id());
  let mut stderr = child.stderr.take().ok_or("Cannot read process output")?;
  let mut buf = [0u8; 2048];
  loop {
    if control.cancelled.load(Ordering::SeqCst) {
      let _ = child.kill();
      return Err("Process cancelled".into());
    }
    match stderr.read(&mut buf) {
      Ok(0) => break,
      Ok(n) => on_chunk(&String::from_utf8_lossy(&buf[..n])),
      Err(_) => break,
    }
  }
  let status = child.wait().map_err(|e| e.to_string())?;
  *control.child_id.lock().unwrap() = None;
  if status.success() { Ok(()) } else { Err(format!("Process failed: {}", status)) }
}

fn run_ffmpeg_task(app: &AppHandle, control: &Arc<JobControl>, payload: &StartPayload, source: &str, index: usize, total: usize, completed_duration: f64, total_duration: f64, started: Instant) -> Result<ToolResult, String> {
  let options = payload.options.clone().unwrap_or_default();
  let (output, preview_type, args) = build_args(&payload.tool_id, source, &payload.output_directory, &options)?;
  let input_size = fs::metadata(source).map_err(|e| e.to_string())?.len();
  let source_duration = duration(app, source);
  let ffmpeg = tool_path(app, "ffmpeg");
  let job_id = control.job_id.clone();
  app.emit("compress:progress", serde_json::json!({ "jobId": job_id, "file": source, "outputFile": output, "index": index, "total": total, "percent": 0, "overallPercent": 0, "etaSeconds": null, "speed": null })).ok();
  run_process(control, &ffmpeg, &args, &mut |chunk| {
    if let Some(sec) = parse_time(chunk) {
      let percent = if source_duration > 0.0 { ((sec / source_duration) * 100.0).round().min(99.0) } else { 0.0 };
      let processed = completed_duration + sec.min(source_duration);
      let overall = if total_duration > 0.0 { ((processed / total_duration) * 100.0).round().min(99.0) } else { percent };
      let elapsed = started.elapsed().as_secs_f64();
      let eta = if overall > 0.0 { Some((elapsed / (overall / 100.0) - elapsed).max(0.0)) } else { None };
      app.emit("compress:progress", serde_json::json!({ "jobId": job_id, "file": source, "outputFile": output, "index": index, "total": total, "percent": percent, "overallPercent": overall, "etaSeconds": eta, "speed": parse_speed(chunk) })).ok();
    }
  })?;
  let output_size = fs::metadata(&output).map_err(|e| e.to_string())?.len();
  let saved = input_size as i64 - output_size as i64;
  Ok(ToolResult {
    source_file: source.into(),
    output_file: output.clone(),
    output_url: file_url(&output),
    input_size,
    output_size,
    input_size_text: format_size(input_size),
    output_size_text: format_size(output_size),
    saved_bytes: saved,
    saved_text: format_size(saved.max(0) as u64),
    saved_percent: if input_size > 0 { ((saved as f64 / input_size as f64) * 100.0).round() as i64 } else { 0 },
    validation: validate_output(app, &output, source_duration, &preview_type),
    preview_type,
  })
}

fn run_document_task(payload: &StartPayload, source: &str) -> Result<ToolResult, String> {
  let ext = match payload.tool_id.as_str() {
    "pdf-to-docx" => ".docx",
    "pdf-to-excel" => ".xlsx",
    "word-to-pdf" | "excel-to-pdf" => ".pdf",
    _ => return Err("Unsupported document converter.".into()),
  };
  let final_output = safe_output(source, &payload.output_directory, ext);
  let source_clone = source.to_string();
  let tool_id = payload.tool_id.clone();
  let (input_size, output_size) = document::convert(&source_clone, &final_output, &tool_id)?;
  let saved = input_size as i64 - output_size as i64;
  Ok(ToolResult {
    source_file: source.into(),
    output_file: final_output.clone(),
    output_url: file_url(&final_output),
    input_size,
    output_size,
    input_size_text: format_size(input_size),
    output_size_text: format_size(output_size),
    saved_bytes: saved,
    saved_text: format_size(saved.max(0) as u64),
    saved_percent: if input_size > 0 { ((saved as f64 / input_size as f64) * 100.0).round() as i64 } else { 0 },
    validation: ValidationResult { ok: output_size > 0, message: "Validated.".into() },
    preview_type: "document".into(),
  })
}

fn run_merge_task(app: &AppHandle, control: &Arc<JobControl>, payload: &StartPayload, files: &[String], started: Instant) -> Result<ToolResult, String> {
  if files.len() < 2 { return Err("Merge video needs at least two files.".into()); }
  let list_path = std::env::temp_dir().join(format!("cardvault-merge-{}.txt", now_id()));
  let mut list_file = fs::File::create(&list_path).map_err(|e| e.to_string())?;
  for file in files {
    writeln!(list_file, "file '{}'", file.replace('\\', "/").replace('\'', "'\\''")).map_err(|e| e.to_string())?;
  }
  let output = safe_output("merged-video.mp4", &payload.output_directory, ".mp4");
  let total_duration = files.iter().map(|f| duration(app, f)).sum::<f64>();
  let input_size = files.iter().filter_map(|f| fs::metadata(f).ok().map(|m| m.len())).sum::<u64>();
  let args = vec!["-hide_banner", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i"]
    .into_iter().map(String::from).chain([list_path.to_string_lossy().to_string(), "-c:v".into(), "libx264".into(), "-preset".into(), "fast".into(), "-crf".into(), "20".into(), "-c:a".into(), "aac".into(), "-b:a".into(), "160k".into(), output.clone()]).collect::<Vec<String>>();
  let ffmpeg = tool_path(app, "ffmpeg");
  let job_id = control.job_id.clone();
  let output_for_event = output.clone();
  run_process(control, &ffmpeg, &args, &mut |chunk| {
    if let Some(sec) = parse_time(chunk) {
      let percent = if total_duration > 0.0 { ((sec / total_duration) * 100.0).round().min(99.0) } else { 0.0 };
      let elapsed = started.elapsed().as_secs_f64();
      let eta = if percent > 0.0 { Some((elapsed / (percent / 100.0) - elapsed).max(0.0)) } else { None };
      app.emit("compress:progress", serde_json::json!({ "jobId": job_id, "file": format!("{} videos", files.len()), "outputFile": output_for_event, "index": 1, "total": 1, "percent": percent, "overallPercent": percent, "etaSeconds": eta, "speed": parse_speed(chunk) })).ok();
    }
  })?;
  let _ = fs::remove_file(list_path);
  let output_size = fs::metadata(&output).map_err(|e| e.to_string())?.len();
  let saved = input_size as i64 - output_size as i64;
  Ok(ToolResult {
    source_file: format!("{} merged files", files.len()),
    output_file: output.clone(),
    output_url: file_url(&output),
    input_size,
    output_size,
    input_size_text: format_size(input_size),
    output_size_text: format_size(output_size),
    saved_bytes: saved,
    saved_text: format_size(saved.max(0) as u64),
    saved_percent: if input_size > 0 { ((saved as f64 / input_size as f64) * 100.0).round() as i64 } else { 0 },
    validation: validate_output(app, &output, total_duration, "video"),
    preview_type: "video".into(),
  })
}

#[tauri::command]
fn select_files(mode: String) -> Vec<String> {
  rfd::FileDialog::new().pick_files().map(|files| files.into_iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>()).map(|files| expand_paths(&files, &mode)).unwrap_or_default()
}

#[tauri::command]
fn select_source_folder(mode: String) -> Vec<String> {
  rfd::FileDialog::new().pick_folder().map(|folder| expand_paths(&[folder.to_string_lossy().to_string()], &mode)).unwrap_or_default()
}

#[tauri::command]
fn select_folder() -> Option<String> {
  rfd::FileDialog::new().pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn select_subtitle() -> Option<String> {
  rfd::FileDialog::new().add_filter("Subtitle", &["srt", "ass", "ssa"]).pick_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn expand_files(payload: ExpandPayload) -> Vec<String> {
  expand_paths(&payload.paths, payload.mode.as_deref().unwrap_or("video"))
}

#[tauri::command]
fn inspect_files(payload: InspectPayload) -> InspectResult {
  let mode = payload.mode.as_deref().unwrap_or("video");
  let files = expand_paths(&payload.files, mode);
  let total = files.iter().filter_map(|f| fs::metadata(f).ok().map(|m| m.len())).sum::<u64>();
  let free = payload.output_directory.as_ref().and_then(|dir| available_space(dir).ok());
  let minimum = total.max(2 * 1024 * 1024 * 1024);
  InspectResult { files, total_input_bytes: total, total_input_text: format_size(total), free_bytes: free, free_text: free.map(format_size).unwrap_or_else(|| "Unknown".into()), low_disk: free.map(|v| v < minimum).unwrap_or(false), minimum_recommended_text: format_size(minimum) }
}

#[tauri::command]
fn check_ffmpeg(app: AppHandle) -> BasicResponse {
  match run_command(&tool_path(&app, "ffmpeg"), &["-version"]) {
    Ok(out) => BasicResponse { ok: true, message: Some(out.lines().next().unwrap_or("FFmpeg ready").into()), job_id: None },
    Err(err) => BasicResponse { ok: false, message: Some(err), job_id: None },
  }
}

#[tauri::command]
fn start_tool(app: AppHandle, state: State<AppState>, payload: StartPayload) -> BasicResponse {
  if state.job.lock().unwrap().is_some() {
    return BasicResponse { ok: false, message: Some("A process is already running.".into()), job_id: None };
  }
  let mode = payload.mode.as_deref().unwrap_or("video");
  let files = expand_paths(&payload.files, mode);
  if files.is_empty() || payload.output_directory.is_empty() {
    return BasicResponse { ok: false, message: Some("Choose files and output folder first.".into()), job_id: None };
  }
  let job_id = now_id();
  let control = Arc::new(JobControl { job_id: job_id.clone(), cancelled: AtomicBool::new(false), paused: AtomicBool::new(false), notify_enabled: payload.notify_enabled.unwrap_or(false), child_id: Mutex::new(None) });
  *state.job.lock().unwrap() = Some(control.clone());
  let app_for_thread = app.clone();
  let thread_job_id = job_id.clone();
  thread::spawn(move || {
    let mut results = Vec::<ToolResult>::new();
    let mut errors = Vec::<FileError>::new();
    let started = Instant::now();
    app_for_thread.emit("compress:state", serde_json::json!({ "jobId": thread_job_id.clone(), "code": "preparingFiles" })).ok();
    if payload.tool_id == "merge-video" {
      match run_merge_task(&app_for_thread, &control, &payload, &files, started) {
        Ok(result) => { app_for_thread.emit("compress:file-complete", serde_json::json!({ "jobId": thread_job_id.clone(), "result": result })).ok(); results.push(result); }
        Err(err) => { let error = FileError { source_file: "merge-video".into(), message: err }; app_for_thread.emit("compress:file-error", serde_json::json!({ "jobId": thread_job_id.clone(), "sourceFile": error.source_file, "message": error.message })).ok(); errors.push(error); }
      }
    } else if payload.mode.as_deref() == Some("document") {
      for (idx, source) in files.iter().enumerate() {
        while control.paused.load(Ordering::SeqCst) && !control.cancelled.load(Ordering::SeqCst) { thread::sleep(Duration::from_millis(250)); }
        if control.cancelled.load(Ordering::SeqCst) { break; }
        app_for_thread.emit("compress:progress", serde_json::json!({ "jobId": thread_job_id.clone(), "file": source, "index": idx + 1, "total": files.len(), "percent": 0, "overallPercent": ((idx as f64 / files.len() as f64) * 100.0).round(), "etaSeconds": null, "speed": null })).ok();
        match run_document_task(&payload, source) {
          Ok(result) => { app_for_thread.emit("compress:file-complete", serde_json::json!({ "jobId": thread_job_id.clone(), "result": result })).ok(); results.push(result); }
          Err(err) => { let error = FileError { source_file: source.clone(), message: err }; app_for_thread.emit("compress:file-error", serde_json::json!({ "jobId": thread_job_id.clone(), "sourceFile": error.source_file, "message": error.message })).ok(); errors.push(error); }
        }
      }
    } else {
      let durations = files.iter().map(|f| duration(&app_for_thread, f)).collect::<Vec<_>>();
      let total_duration = durations.iter().sum::<f64>();
      let mut completed = 0.0;
      for (idx, source) in files.iter().enumerate() {
        while control.paused.load(Ordering::SeqCst) && !control.cancelled.load(Ordering::SeqCst) { thread::sleep(Duration::from_millis(250)); }
        if control.cancelled.load(Ordering::SeqCst) { break; }
        match run_ffmpeg_task(&app_for_thread, &control, &payload, source, idx + 1, files.len(), completed, total_duration, started) {
          Ok(result) => { completed += durations[idx]; app_for_thread.emit("compress:file-complete", serde_json::json!({ "jobId": thread_job_id.clone(), "result": result })).ok(); results.push(result); }
          Err(err) => { let error = FileError { source_file: source.clone(), message: err }; app_for_thread.emit("compress:file-error", serde_json::json!({ "jobId": thread_job_id.clone(), "sourceFile": error.source_file, "message": error.message })).ok(); errors.push(error); }
        }
      }
    }
    if control.notify_enabled {
      let _ = app_for_thread.notification().builder().title("CardVault selesai").body(format!("{} berhasil, {} gagal.", results.len(), errors.len())).show();
    }
    app_for_thread.emit("compress:complete", serde_json::json!({ "jobId": thread_job_id, "cancelled": control.cancelled.load(Ordering::SeqCst), "results": results, "errors": errors })).ok();
    if let Some(state) = app_for_thread.try_state::<AppState>() { *state.job.lock().unwrap() = None; }
  });
  BasicResponse { ok: true, message: None, job_id: Some(job_id) }
}

#[tauri::command]
fn cancel_job(state: State<AppState>) -> BasicResponse {
  if let Some(job) = state.job.lock().unwrap().as_ref() {
    job.cancelled.store(true, Ordering::SeqCst);
    if let Some(pid) = *job.child_id.lock().unwrap() {
      #[cfg(windows)] { let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).output(); }
    }
  }
  BasicResponse { ok: true, message: None, job_id: None }
}

#[tauri::command]
fn pause_job(state: State<AppState>) -> BasicResponse {
  if let Some(job) = state.job.lock().unwrap().as_ref() { job.paused.store(true, Ordering::SeqCst); }
  BasicResponse { ok: true, message: None, job_id: None }
}

#[tauri::command]
fn resume_job(state: State<AppState>) -> BasicResponse {
  if let Some(job) = state.job.lock().unwrap().as_ref() { job.paused.store(false, Ordering::SeqCst); }
  BasicResponse { ok: true, message: None, job_id: None }
}

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![select_files, select_source_folder, select_folder, select_subtitle, expand_files, inspect_files, check_ffmpeg, start_tool, cancel_job, pause_job, resume_job])
    .run(tauri::generate_context!())
    .expect("error while running CardVault");
}
