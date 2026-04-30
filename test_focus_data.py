import json

with open("backend/data/focus_lessons.json", encoding="utf-8") as f:
    data = json.load(f)

for key in ["1.1", "1.2", "1.3"]:
    print(key, data[key]["type"], len(data[key]["text"]))
    print(data[key]["text"][:300])
    print("---")