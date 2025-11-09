# -*- coding: utf-8 -*-
import sys, json
from pathlib import Path
from lab2_ai_deliverables.ml.models.baseline import generate_flashcards

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m lab2_ai_deliverables.ml.run_baseline <path_to_txt> [lang=en|ru] [max_cards=10]")
        sys.exit(1)
    path = Path(sys.argv[1])
    lang = sys.argv[2] if len(sys.argv) > 2 else "en"
    max_cards = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    text = path.read_text(encoding="utf-8")
    cards = generate_flashcards(text, lang=lang, max_cards=max_cards)
    print(json.dumps(cards, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
