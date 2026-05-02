from pypdf import PdfReader
src = r"C:\Users\cpani\nexus-erp-deploy\Module Functionality Documents.pdf"
dst = r"C:\Users\cpani\nexus-erp-deploy\.pdf-extract.txt"
r = PdfReader(src)
with open(dst, "w", encoding="utf-8") as out:
    for i, p in enumerate(r.pages):
        out.write(f"--- PAGE {i+1} ---\n")
        out.write((p.extract_text() or "") + "\n")
print("OK", len(r.pages))
