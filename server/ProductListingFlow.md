---

# 📄 Amazon Listing API — Implementation Notes

This document explains the key changes made to the **Amazon Listing API integration**, focusing on how product type schemas are now handled.

---

## 1. Catalog Flow (No Change)

* The **Catalog API call** remains the same.
* We still attempt to fetch product details from Amazon (by ASIN) to detect the **product type** dynamically.
* If Catalog API fails, fallback logic (keyword-based detection) is used.

---

## 2. Access Token (No Change)

* The **LWA token flow** (Login With Amazon) to retrieve an `access_token` for SP-API requests remains unchanged.
* All listing requests still use the fresh access token obtained during this step.

---

## 3. Product Type Handling (Updated)

* **Earlier:** Product type was either **hardcoded** (e.g., `"LUGGAGE"`) or guessed by keywords.
* **Now:**

  * Product type is determined using **Catalog API**.
  * We no longer send arbitrary values — the type is **Amazon-defined**.

---

## 4. Product Type Schema (New)

* We now leverage the **Product Type Definitions API** to fetch schema for the detected product type.
* Example:

  * If detected type = `HOME`, we fetch `HOME` schema.
  * Schema defines exactly which attributes are **required** and their **data types**.

---

## 5. Payload Construction (Updated)

* **Earlier:** Payloads were minimal and generic.
* **Now:** Payloads are constructed to **match Amazon’s schema** (per product type).
* This ensures validation passes and listings are accepted.

---

## 6. Static Data vs Dynamic Data

* **Static demo values** are used for now to satisfy schema requirements.
* Once enough product metadata is available, these values can be mapped dynamically to schema fields.

---

## 📊 Before vs After Example

### **Before (Minimal Payload)**

```json
{
  "productType": "LUGGAGE",
  "requirements": "LISTING",
  "attributes": {
    "condition_type": [
      { "value": "new_new", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "item_name": [
      { "value": "LEDVANCE LED Grow Light", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "list_price": [
      { "value": { "Amount": 29.99, "CurrencyCode": "EUR" }, "marketplace_id": "A1PA6795UKMFR9" }
    ]
  }
}
```

## ⚠️ Problem: Too minimal → missing required attributes → listing often rejected.

---

### **After (Schema-Based Payload — HOME Example)**

```json
{
  "productType": "HOME",
  "requirements": "LISTING",
  "attributes": {
    "item_name": [{ "value": "LEDVANCE LED Grow Light 1350 Lumen", "marketplace_id": "A1PA6795UKMFR9" }],
    "brand": [{ "value": "Ledvance", "marketplace_id": "A1PA6795UKMFR9" }],
    "manufacturer": [{ "value": "Ledvance GmbH", "marketplace_id": "A1PA6795UKMFR9" }],
    "model_number": [{ "value": "LV-PLANT-1350", "marketplace_id": "A1PA6795UKMFR9" }],
    "part_number": [{ "value": "1350PLANT", "marketplace_id": "A1PA6795UKMFR9" }],
    "externally_assigned_product_identifier": [
      { "type": "EAN", "value": "4058075812345", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "product_description": [
      { "value": "Energy-efficient LED grow light with 1350 lumens.", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "bullet_point": [
      { "value": "1350 lumen LED light for indoor gardening", "marketplace_id": "A1PA6795UKMFR9" },
      { "value": "Energy-efficient with long lifespan", "marketplace_id": "A1PA6795UKMFR9" },
      { "value": "Suitable for herbs, flowers, and vegetables", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "country_of_origin": [{ "value": "DE", "marketplace_id": "A1PA6795UKMFR9" }],
    "list_price": [
      { "value_with_tax": 29.99, "currency": "EUR", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "item_package_weight": [
      { "value": 500, "unit": "grams", "marketplace_id": "A1PA6795UKMFR9" }
    ],
    "item_package_dimensions": [
      {
        "length": { "value": 200, "unit": "millimeters" },
        "width": { "value": 150, "unit": "millimeters" },
        "height": { "value": 100, "unit": "millimeters" },
        "marketplace_id": "A1PA6795UKMFR9"
      }
    ],
    "batteries_required": [{ "value": "false", "marketplace_id": "A1PA6795UKMFR9" }]
  }
}
```

## Now payload matches schema → higher success rate with Amazon Listing API.

---