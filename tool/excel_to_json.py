"""Convert Mg.xlsx inventory to products.json for the Flutter app using pandas."""
import json
import pandas as pd

SRC = r"C:\Users\gigabyte\Desktop\invtory-encyclopedia\Mg.xlsx"
OUT = r"C:\Users\gigabyte\Desktop\inventory_app\assets\products.json"

# Read the Excel file
df = pd.read_excel(SRC, sheet_name="A", header=0)

# Rename columns to simpler names
df = df.rename(columns={
    "Référence": "ref",
    "Désignation": "name",
    "Quantité": "qty",
    "Famille": "family",
    "S/Famille 1": "sub1",
    "S/Famille 2": "sub2",
    "S/Famille 3": "sub3",
    "Fournisseur": "supplier",
})

# Keep only relevant columns
cols = ["ref", "name", "qty", "family", "sub1", "sub2", "sub3", "supplier"]
df = df[[c for c in cols if c in df.columns]]

# Drop rows with no reference
df = df.dropna(subset=["ref"])

# Clean strings
for c in ["ref", "name", "family", "sub1", "sub2", "sub3", "supplier"]:
    if c in df.columns:
        df[c] = df[c].fillna("").astype(str).str.strip()

# Convert qty to float (handle empty)
df["qty"] = pd.to_numeric(df["qty"], errors="coerce").fillna(0)

# Build products list
products = []
for _, row in df.iterrows():
    products.append({
        "ref": row["ref"],
        "name": row["name"],
        "qty": float(row["qty"]),
        "family": row["family"],
        "sub1": row["sub1"],
        "sub2": row["sub2"],
        "sub3": row["sub3"],
        "supplier": row["supplier"],
        "alternatives": [],  # filled later
    })

# Write JSON
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"Converted {len(products)} products to {OUT}")
