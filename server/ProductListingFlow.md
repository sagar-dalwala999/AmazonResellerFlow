---

# 📄 Amazon Listing API — Implementation Notes

This document explains the **changes made to the Amazon Listing API integration** and highlights how product type and schema are handled for better compliance.

---

## 1. Catalog API (No Change)

* Existing integration for fetching product details works without modification.
* **Access token handling also remains unchanged.**

---

## 2. Product Type Handling (Updated)

* Previously, product type was **hardcoded** (e.g., `LUGGAGE`, `HOME`).
* We now **validate product type** using the **Amazon Product Type API** to ensure correctness.
* **Future Improvement:** This can be made **fully dynamic** by mapping product type directly from Catalog API → Product Type API.

---

## 3. Product Type Schema

* We now leverage the **Product Type Definitions API** to fetch schema for the detected product type.
* Schema defines:

  * Which attributes are **required**.
  * The **data types** and valid values.

---

## 4. Payload Construction (Updated)

* **Earlier:** Payloads were minimal and generic → often rejected.
* **Now:** Payloads are constructed to **match Amazon’s product type schema**.
* This ensures validation passes and listings are **successfully created**.

---

## 5. Static vs Dynamic Data

* Currently, we are **using static values** (dimensions, weight, bullet points) to satisfy schema.
* **Future:** Once product metadata is available, values will be mapped **dynamically** according to schema fields.

---

## 6. Before vs After

| **Before (Minimal Payload)**                                                                                                                                                                                                                                                                                | **After (Schema-Based Payload — HOME Example)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `json<br>{<br>  "productType": "LUGGAGE",<br>  "requirements": "LISTING",<br>  "attributes": {<br>    "condition_type": [{ "value": "new_new" }],<br>    "item_name": [{ "value": "LEDVANCE LED Grow Light" }],<br>    "list_price": [{ "value": { "Amount": 29.99, "CurrencyCode": "EUR" } }]<br>  }<br>}` | `json<br>{<br>  "productType": "HOME",<br>  "requirements": "LISTING",<br>  "attributes": {<br>    "item_name": [{ "value": "LEDVANCE LED Grow Light 1350 Lumen" }],<br>    "brand": [{ "value": "Ledvance" }],<br>    "manufacturer": [{ "value": "Ledvance GmbH" }],<br>    "model_number": [{ "value": "LV-PLANT-1350" }],<br>    "part_number": [{ "value": "1350PLANT" }],<br>    "externally_assigned_product_identifier": [{ "type": "EAN", "value": "4058075812345" }],<br>    "product_description": [{ "value": "Energy-efficient LED grow light with 1350 lumens." }],<br>    "bullet_point": [<br>      { "value": "1350 lumen LED light for indoor gardening" },<br>      { "value": "Energy-efficient with long lifespan" },<br>      { "value": "Suitable for herbs, flowers, and vegetables" }<br>    ],<br>    "country_of_origin": [{ "value": "DE" }],<br>    "list_price": [{ "value_with_tax": 29.99, "currency": "EUR" }],<br>    "item_package_weight": [{ "value": 500, "unit": "grams" }],<br>    "item_package_dimensions": [{<br>      "length": { "value": 200, "unit": "millimeters" },<br>      "width": { "value": 150, "unit": "millimeters" },<br>      "height": { "value": 100, "unit": "millimeters" }<br>    }],<br>    "batteries_required": [{ "value": "false" }]<br>  }<br>}` |

---

## 7. Flow Diagram

The updated API flow:

```
Input Data → Catalog API → Product Type → Product Type Schema → Build Payload → Amazon Listing API
```

---

## Summary

* ✅ Catalog API & access token handling → **no change**.
* ✅ Product Type → **validated via Amazon API** (future: fully dynamic).
* ✅ Product Type Schema → **fetched dynamically**.
* ✅ Payload → **matches schema**, increasing acceptance rate.
* ⚡ Static values for demo → **will be dynamic** in production.

---