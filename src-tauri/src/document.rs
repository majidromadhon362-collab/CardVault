use std::fs;
use std::io::{Read, Write};
use std::path::Path;

pub fn convert(source: &str, output: &str, tool_id: &str) -> Result<(u64, u64), String> {
  let ext = Path::new(source)
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| e.to_lowercase())
    .unwrap_or_default();

  let input_size = fs::metadata(source).map_err(|e| e.to_string())?.len();

  match tool_id {
    "word-to-pdf" => match ext.as_str() {
      "docx" => docx_to_pdf(source, output)?,
      _ => {
        return Err("Format .doc lama tidak didukung. Simpan sebagai .docx dulu.".into());
      }
    },
    "excel-to-pdf" => match ext.as_str() {
      "xlsx" => xlsx_to_pdf(source, output)?,
      _ => {
        return Err("Format .xls lama tidak didukung. Simpan sebagai .xlsx dulu.".into());
      }
    },
    "pdf-to-docx" => {
      if ext != "pdf" {
        return Err("File harus berupa PDF.".into());
      }
      pdf_to_docx(source, output)?;
    }
    "pdf-to-excel" => {
      if ext != "pdf" {
        return Err("File harus berupa PDF.".into());
      }
      pdf_to_xlsx(source, output)?;
    }
    _ => return Err("Tool tidak dikenal.".into()),
  }

  let output_size = fs::metadata(output).map_err(|e| e.to_string())?.len();
  if output_size == 0 {
    return Err("Output kosong. Konversi gagal.".into());
  }

  Ok((input_size, output_size))
}

fn docx_to_pdf(source: &str, output: &str) -> Result<(), String> {
  let file = fs::File::open(source).map_err(|e| format!("Gagal baca file: {}", e))?;
  let mut archive =
    zip::ZipArchive::new(file).map_err(|e| format!("Gagal baca ZIP: {}", e))?;

  let mut doc_xml = String::new();
  let mut entry = archive
    .by_name("word/document.xml")
    .map_err(|_| String::from("word/document.xml tidak ditemukan."))?;
  entry
    .read_to_string(&mut doc_xml)
    .map_err(|e| format!("Gagal baca XML: {}", e))?;

  let lines = extract_docx_text(&doc_xml);
  if lines.is_empty() {
    return Err("Tidak ada teks ditemukan di dokumen.".into());
  }

  generate_pdf(&lines, output)
}

fn xlsx_to_pdf(source: &str, output: &str) -> Result<(), String> {
  use calamine::{open_workbook, Data, Reader, Xlsx};

  let mut workbook: Xlsx<_> =
    open_workbook(source).map_err(|e| format!("Gagal baca Excel: {}", e))?;

  let names = workbook.sheet_names().to_vec();
  let sheet = names.first().ok_or("Tidak ada sheet.".to_string())?;

  let mut lines = Vec::new();
  if let Ok(range) = workbook.worksheet_range(sheet) {
    for row in range.rows() {
      let parts: Vec<String> = row
        .iter()
        .map(|c| match c {
          Data::String(s) => s.clone(),
          Data::Float(f) => {
            if f.fract() == 0.0 {
              format!("{}", *f as i64)
            } else {
              format!("{:.2}", f)
            }
          }
          Data::Int(i) => format!("{}", i),
          Data::Bool(b) => format!("{}", b),
          Data::DateTime(d) => format!("{}", d),
          _ => String::new(),
        })
        .collect();
      lines.push(parts.join("\t"));
    }
  }

  if lines.is_empty() {
    return Err("Tidak ada data.".into());
  }

  generate_pdf(&lines, output)
}

fn pdf_to_docx(source: &str, output: &str) -> Result<(), String> {
  use lopdf::Document;

  let doc = Document::load(source).map_err(|e| format!("Gagal baca PDF: {}", e))?;
  let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
  let mut text = String::new();

  for page_num in &pages {
    if let Ok(content) = doc.extract_text(&[*page_num]) {
      text.push_str(&content);
      text.push_str("\n\n");
    }
  }

  let lines = normalize_pdf_text_lines(&text);
  if lines.is_empty() {
    return Err("Tidak ada teks di PDF.".into());
  }

  let refs = lines.iter().map(String::as_str).collect::<Vec<_>>();
  generate_docx(&refs, output)
}

fn pdf_to_xlsx(source: &str, output: &str) -> Result<(), String> {
  use lopdf::Document;

  let doc = Document::load(source).map_err(|e| format!("Gagal baca PDF: {}", e))?;
  let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
  let mut text = String::new();

  for page_num in &pages {
    if let Ok(content) = doc.extract_text(&[*page_num]) {
      text.push_str(&content);
      text.push('\n');
    }
  }

  let lines: Vec<&str> = text.lines().collect();
  if lines.is_empty() {
    return Err("Tidak ada teks di PDF.".into());
  }

  generate_xlsx(&lines, output)
}

fn normalize_pdf_text_lines(text: &str) -> Vec<String> {
  let mut paragraphs = Vec::new();
  let mut current = String::new();

  for raw in text.lines() {
    let line = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if line.is_empty() {
      if !current.trim().is_empty() {
        paragraphs.push(current.trim().to_string());
        current.clear();
      }
      continue;
    }

    if current.is_empty() {
      current.push_str(&line);
      continue;
    }

    if should_start_new_paragraph(&current, &line) {
      paragraphs.push(current.trim().to_string());
      current.clear();
      current.push_str(&line);
    } else {
      append_pdf_line(&mut current, &line);
    }
  }

  if !current.trim().is_empty() {
    paragraphs.push(current.trim().to_string());
  }

  paragraphs
}

fn should_start_new_paragraph(current: &str, next: &str) -> bool {
  let current = current.trim();
  let next = next.trim();
  if current.len() < 40 {
    return false;
  }
  let ends_sentence = current.ends_with('.') || current.ends_with('!') || current.ends_with('?');
  let looks_like_heading = next.len() <= 48 && !next.ends_with('.') && next.chars().filter(|c| c.is_alphabetic()).count() > 2;
  let starts_uppercase = next.chars().find(|c| c.is_alphabetic()).map(|c| c.is_uppercase()).unwrap_or(false);
  ends_sentence && (looks_like_heading || starts_uppercase)
}

fn append_pdf_line(current: &mut String, line: &str) {
  let no_space_before = matches!(line.chars().next(), Some('.') | Some(',') | Some(':') | Some(';') | Some('!') | Some('?') | Some(')') | Some(']'));
  let no_space_after = current.ends_with('(') || current.ends_with('[') || current.ends_with('/') || current.ends_with('-');
  if !no_space_before && !no_space_after {
    current.push(' ');
  }
  current.push_str(line);
}

fn extract_docx_text(xml: &str) -> Vec<String> {
  use quick_xml::events::Event;
  use quick_xml::Reader;

  let mut reader = Reader::from_str(xml);
  let mut buf = Vec::new();
  let mut lines = Vec::new();
  let mut current = String::new();
  let mut in_t = false;

  loop {
    match reader.read_event_into(&mut buf) {
      Ok(Event::Start(ref e)) => {
        if e.local_name().as_ref() == b"t" {
          in_t = true;
        }
      }
      Ok(Event::Text(ref e)) => {
        if in_t {
          if let Ok(text) = e.unescape() {
            current.push_str(&text);
          }
        }
      }
      Ok(Event::End(ref e)) => match e.local_name().as_ref() {
        b"t" => in_t = false,
        b"p" => {
          let trimmed = current.trim().to_string();
          if !trimmed.is_empty() {
            lines.push(trimmed);
          }
          current = String::new();
        }
        _ => {}
      },
      Ok(Event::Eof) => break,
      Err(_) => break,
      _ => {}
    }
    buf.clear();
  }

  let trimmed = current.trim().to_string();
  if !trimmed.is_empty() {
    lines.push(trimmed);
  }

  lines
}

fn generate_pdf(lines: &[String], output: &str) -> Result<(), String> {
  use printpdf::*;

  let font_size = 11.0;
  let line_h = 5.0;
  let margin = 20.0;
  let pw = 210.0;
  let ph = 297.0;
  let cpl = (170.0 / (font_size * 0.3)) as usize;

  let (doc, mut cur_page, mut cur_layer) =
    PdfDocument::new("CardVault Document", Mm(pw), Mm(ph), "Layer 1");

  let font = doc
    .add_builtin_font(BuiltinFont::Helvetica)
    .map_err(|e| format!("Gagal muat font: {}", e))?;

  let mut y = ph - margin;
  let mut page_num = 1;

  for line in lines {
    if y < margin {
      page_num += 1;
      let (np, nl) = doc.add_page(Mm(pw), Mm(ph), format!("Page {}", page_num));
      cur_page = np;
      cur_layer = nl;
      y = ph - margin;
    }

    let mut rem = line.as_str();
    while !rem.is_empty() && y >= margin {
      if y < margin {
        page_num += 1;
        let (np, nl) = doc.add_page(Mm(pw), Mm(ph), format!("Page {}", page_num));
        cur_page = np;
        cur_layer = nl;
        y = ph - margin;
      }

      let chunk = if rem.len() <= cpl {
        let out = rem;
        rem = "";
        out
      } else {
        let brk = rem[..cpl].rfind(' ').map(|p| p + 1).unwrap_or(cpl);
        let out = &rem[..brk];
        rem = &rem[brk..];
        out
      };

      doc
        .get_page(cur_page)
        .get_layer(cur_layer)
        .use_text(chunk, font_size, Mm(margin), Mm(y), &font);
      y -= line_h;
    }
  }

  let file = fs::File::create(output).map_err(|e| e.to_string())?;
  doc
    .save(&mut std::io::BufWriter::new(file))
    .map_err(|e| format!("Gagal simpan PDF: {}", e))?;

  Ok(())
}

fn generate_docx(lines: &[&str], output: &str) -> Result<(), String> {
  use zip::write::FileOptions;
  use zip::ZipWriter;

  let file = fs::File::create(output).map_err(|e| e.to_string())?;
  let mut zip = ZipWriter::new(file);
  let opt: FileOptions<'_, ()> =
    FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

  let content_types = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
</Types>";

  let rels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>
</Relationships>";

  let doc_rels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>
</Relationships>";

  zip
    .start_file("[Content_Types].xml", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(content_types.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("_rels/.rels", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(rels.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("word/_rels/document.xml.rels", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(doc_rels.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("word/document.xml", opt)
    .map_err(|e| e.to_string())?;

  write!(
    zip,
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">
  <w:body>
"
  )
  .map_err(|e| e.to_string())?;

  for line in lines {
    if line.is_empty() {
      writeln!(
        zip,
        "    <w:p><w:pPr><w:spacing w:after=\"200\"/></w:pPr></w:p>"
      )
      .map_err(|e| e.to_string())?;
    } else {
      let escaped = line
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;");
      writeln!(
        zip,
        "    <w:p>
      <w:r>
        <w:t xml:space=\"preserve\">{}</w:t>
      </w:r>
    </w:p>",
        escaped
      )
      .map_err(|e| e.to_string())?;
    }
  }

  write!(
    zip,
    "  </w:body>
</w:document>"
  )
  .map_err(|e| e.to_string())?;

  zip.finish().map_err(|e| e.to_string())?;
  Ok(())
}

fn generate_xlsx(lines: &[&str], output: &str) -> Result<(), String> {
  use zip::write::FileOptions;
  use zip::ZipWriter;

  let file = fs::File::create(output).map_err(|e| e.to_string())?;
  let mut zip = ZipWriter::new(file);
  let opt: FileOptions<'_, ()> =
    FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

  let content_types = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>
  <Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>
</Types>";

  let rels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>
</Relationships>";

  let wb = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">
  <sheets>
    <sheet name=\"Sheet1\" sheetId=\"1\" r:id=\"rId1\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"/>
  </sheets>
</workbook>";

  let wb_rels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>
</Relationships>";

  zip
    .start_file("[Content_Types].xml", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(content_types.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("_rels/.rels", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(rels.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("xl/workbook.xml", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(wb.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("xl/_rels/workbook.xml.rels", opt)
    .map_err(|e| e.to_string())?;
  zip
    .write_all(wb_rels.as_bytes())
    .map_err(|e| e.to_string())?;

  zip
    .start_file("xl/worksheets/sheet1.xml", opt)
    .map_err(|e| e.to_string())?;

  write!(
    zip,
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">
  <sheetData>
"
  )
  .map_err(|e| e.to_string())?;

  for (i, line) in lines.iter().enumerate() {
    let row_num = i + 1;
    let cols: Vec<&str> = line.split('\t').collect();
    write!(zip, "    <row r=\"{}\">", row_num).map_err(|e| e.to_string())?;
    for (j, cell) in cols.iter().enumerate() {
      let col_letter = col_letter(j + 1);
      let escaped = cell
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;");
      write!(
        zip,
        "<c r=\"{}{}\" t=\"inlineStr\"><is><t>{}</t></is></c>",
        col_letter, row_num, escaped
      )
      .map_err(|e| e.to_string())?;
    }
    writeln!(zip, "</row>").map_err(|e| e.to_string())?;
  }

  write!(
    zip,
    "  </sheetData>
</worksheet>"
  )
  .map_err(|e| e.to_string())?;

  zip.finish().map_err(|e| e.to_string())?;
  Ok(())
}

fn col_letter(n: usize) -> String {
  let mut n = n;
  let mut s = String::new();
  while n > 0 {
    n -= 1;
    s.insert(0, (b'A' + (n % 26) as u8) as char);
    n /= 26;
  }
  s
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn test_path(extension: &str) -> String {
    let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    std::env::temp_dir().join(format!("cardvault-doc-test-{}.{}", id, extension)).to_string_lossy().to_string()
  }

  #[test]
  fn converts_digital_pdf_to_docx() {
    let pdf = test_path("pdf");
    let docx = test_path("docx");
    generate_pdf(&["CardVault native document converter test".to_string()], &pdf).unwrap();

    let result = convert(&pdf, &docx, "pdf-to-docx").unwrap();
    assert!(result.0 > 0);
    assert!(result.1 > 0);

    let file = fs::File::open(&docx).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    let mut xml = String::new();
    archive.by_name("word/document.xml").unwrap().read_to_string(&mut xml).unwrap();
    assert!(xml.contains("CardVault"));

    let _ = fs::remove_file(pdf);
    let _ = fs::remove_file(docx);
  }

  #[test]
  fn normalizes_word_per_line_pdf_text() {
    let lines = normalize_pdf_text_lines("Ini\nadalah\ncontoh\nteks\nyang\nterpecah\nper\nkata\n.\n\nParagraf\nbaru\nberikutnya\n.");
    assert_eq!(lines.len(), 2);
    assert_eq!(lines[0], "Ini adalah contoh teks yang terpecah per kata.");
    assert_eq!(lines[1], "Paragraf baru berikutnya.");
  }
}
