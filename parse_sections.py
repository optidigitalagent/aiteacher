import json

with open("focus2_extracted.json", "r", encoding="utf-8") as f:
    pages = json.load(f)

sections = {}
current_section = None
counter = 1

keywords = ["Vocabulary", "Grammar", "Listening", "Reading", "Speaking"]

for page in pages:
    text = page["text"]

    for keyword in keywords:
        if keyword.lower() in text.lower():
            current_section = f"section_{counter}"
            sections[current_section] = text
            counter += 1
            break

    if current_section:
        sections[current_section] += "\n" + text

with open("focus2_sections.json", "w", encoding="utf-8") as f:
    json.dump(sections, f, ensure_ascii=False, indent=2)

print("Done → focus2_sections.json")