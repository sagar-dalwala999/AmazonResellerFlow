export function buildLuggagePayload(data: {
  sku: string;
  productName: string;
  brand: string;
  manufacturer?: string;
  price: number;
  currency?: string;
  color?: string;
  dimensions?: { length: number; width: number; height: number; unit: string };
  material?: string;
  countryOfOrigin?: string;
  style?: string;
  modelName?: string;
  modelNumber?: string;
  department?: string;
  packageDimensions?: { length: number; width: number; height: number; unit: string };
  packageWeight?: { value: number; unit: string };
  description?: string;
  ean?: string;
  browseNode?: string;
  bullets?: string[];
}) {
  return {
    productType: "LUGGAGE",
    requirements: "LISTING",
    attributes: {
      item_name: [{ value: data.productName }],
      brand: [{ value: data.brand }],
      manufacturer: [{ value: data.manufacturer || data.brand }],
      condition_type: [{ value: "new_new" }],
      list_price: [{
        value_with_tax: data.price,
        currency: data.currency || "EUR",
      }],
      color: [{ value: data.color || "Black" }],
      item_dimensions: [{
        length: { value: data.dimensions?.length || 60, unit: data.dimensions?.unit || "centimeters" },
        width: { value: data.dimensions?.width || 40, unit: data.dimensions?.unit || "centimeters" },
        height: { value: data.dimensions?.height || 25, unit: data.dimensions?.unit || "centimeters" },
      }],
      bullet_point: (data.bullets || [
        "Durable polycarbonate shell",
        "Expandable storage",
        "360° spinner wheels"
      ]).map(v => ({ value: v })),
      batteries_required: [{ value: "false" }],
      material: [{ value: data.material || "Polycarbonate" }],
      country_of_origin: [{ value: data.countryOfOrigin || "CN" }],
      style: [{ value: data.style || "Hardside Spinner" }],
      model_name: [{ value: data.modelName || "DefaultModel" }],
      department: [{ value: data.department || "Unisex" }],
      item_package_dimensions: [{
        length: { value: data.packageDimensions?.length || 650, unit: data.packageDimensions?.unit || "millimeters" },
        width: { value: data.packageDimensions?.width || 450, unit: data.packageDimensions?.unit || "millimeters" },
        height: { value: data.packageDimensions?.height || 300, unit: data.packageDimensions?.unit || "millimeters" },
      }],
      merchant_suggested_asin: [{ value: data.sku }],
      model_number: [{ value: data.modelNumber || "MODEL123" }],
      supplier_declared_dg_hz_regulation: [{ value: "not_applicable" }],
      item_package_weight: [{
        value: data.packageWeight?.value || 4000,
        unit: data.packageWeight?.unit || "grams",
      }],
      product_description: [{ value: data.description || "Durable lightweight suitcase for travel." }],
      recommended_browse_nodes: [{ value: data.browseNode || "123456789" }],
      externally_assigned_product_identifier: [{
        type: "EAN",
        value: data.ean || "4001234567890",
      }],
    }
  };
}
