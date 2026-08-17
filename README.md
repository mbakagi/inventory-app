# ST3S Inventory

Flutter inventory management app for ST3S - fire panels, detectors, access control, and sirens.

## Features

- **Count Mode** - Scan barcodes with the camera or use OCR to identify products
- **Product Catalog** - Browse, search, and filter the full product catalog
- **Count Sessions** - Save, view, export (Excel), and import count sessions
- **Offline Storage** - All data stored locally with Hive
- **Fuzzy Search** - Find products by reference or name with fuzzy matching

## Getting Started

### Prerequisites

- Flutter SDK (^3.12.2)
- Android SDK (for Android builds)

### Setup

```bash
# Install dependencies
flutter pub get

# Run the app
flutter run

# Run tests
flutter test

# Build for Android
flutter build apk

# Build for web
flutter build web --release --base-href /inventory-app/
```

## Data

The product catalog is loaded from `assets/products.json`, which is generated from the
Excel inventory file using `tool/excel_to_json.py`:

```bash
python tool/excel_to_json.py
```

## Deployment

The app is configured to auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`
on every push to `main`.

## Project Structure

```
lib/
├── main.dart              # App entry point & state management
├── data/
│   └── catalog_loader.dart # Product catalog loading & fuzzy search
├── models/
│   ├── product.dart        # Product model
│   └── count_session.dart  # Count session & entry models
├── storage/
│   └── session_store.dart  # Hive-based local storage
└── ui/
    ├── home_screen.dart    # Main navigation
    ├── count_screen.dart   # Barcode scanning & OCR counting
    ├── catalog_screen.dart # Product catalog browser
    └── sessions_screen.dart # Session history & Excel export/import