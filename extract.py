import fitz
import pytesseract
from PIL import Image
import io
import json

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

doc = fitz.open("C:/Users/Admin/Downloads/1606679541_1focus_2_student_s_book.pdf")

pages = []

for i in range(len(doc)):
    pix = doc[i].get_pixmap(dpi=300)
    img = Image.open(io.BytesIO(pix.tobytes("png")))

    text = pytesseract.image_to_string(img, lang="eng")

    pages.append({
        "page": i + 1,
        "text": text
    })

    print(f"Page {i+1} done, chars: {len(text)}")

with open("focus2_extracted.json", "w", encoding="utf-8") as f:
    json.dump(pages, f, ensure_ascii=False, indent=2)

print("Done → focus2_extracted.json")