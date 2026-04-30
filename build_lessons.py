import json

with open("focus2_extracted.json", encoding="utf-8") as f:
    pages = json.load(f)

with open("focus_mapping.json", encoding="utf-8") as f:
    mapping = json.load(f)

result = {}

for section, data in mapping.items():
    text = ""
    for p in data["pages"]:
        page_text = pages[p - 1]["text"]
        text += "\n" + page_text

    result[section] = {
        "type": data["type"],
        "text": text
    }

with open("focus_lessons.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("Done → focus_lessons.json")