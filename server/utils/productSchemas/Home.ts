export interface HomePayloadInput {
  sku: string;
  productName: string;
  brand: string;
  manufacturer?: string;
  modelNumber?: string;
  partNumber?: string;
  ean?: string;
  suggestedAsin?: string;
  description?: string;
  bullets?: string[];
  countryOfOrigin?: string;
  browseNode?: string;
  size?: string;
  color?: string;
  numberOfItems?: number;
  numberOfBoxes?: number;
  packageWeight?: { value: number; unit: string };
  packageDimensions?: { length: number; width: number; height: number; unit: string };
  batteriesRequired?: string; // "true" | "false"
  isFragile?: string; // "true" | "false"
  price: number;
  currency?: string;
  plugType?: string; // e.g., "no_plug"
  voltageFrequency?: string; // e.g., "100v_120v_50hz"
}

export function buildHomePayload(data: HomePayloadInput) {
  return {
    productType: "HOME",
    requirements: "LISTING",
    attributes: {
      item_name: [{ value: data.productName }],
      brand: [{ value: data.brand }],
      manufacturer: [{ value: data.manufacturer || data.brand }],
      model_number: [{ value: data.modelNumber || "MODEL123" }],
      part_number: [{ value: data.partNumber || "PART123" }],
      externally_assigned_product_identifier: [{
        type: "EAN",
        value: data.ean || "4001234567890",
      }],
      merchant_suggested_asin: [{ value: data.suggestedAsin || data.sku }],
      product_description: [{
        value: data.description || "High-quality home product for daily use."
      }],
      bullet_point: (data.bullets || [
        "Durable and reliable",
        "Modern design",
        "Suitable for everyday use"
      ]).map(v => ({ value: v })),
      country_of_origin: [{ value: data.countryOfOrigin || "DE" }],
      recommended_browse_nodes: [{ value: data.browseNode || "123456789" }],
      supplier_declared_dg_hz_regulation: [{ value: "not_applicable" }],
      size: [{ value: data.size || "Standard" }],
      color: [{ value: data.color || "White" }],
      number_of_items: [{ value: String(data.numberOfItems || 1) }],
      number_of_boxes: [{ value: String(data.numberOfBoxes || 1) }],
      item_package_weight: [{
        value: data.packageWeight?.value || 500,
        unit: data.packageWeight?.unit || "grams",
      }],
      item_package_dimensions: [{
        length: { value: data.packageDimensions?.length || 200, unit: data.packageDimensions?.unit || "millimeters" },
        width: { value: data.packageDimensions?.width || 150, unit: data.packageDimensions?.unit || "millimeters" },
        height: { value: data.packageDimensions?.height || 100, unit: data.packageDimensions?.unit || "millimeters" },
      }],
      batteries_required: [{ value: data.batteriesRequired || "false" }],
      is_fragile: [{ value: data.isFragile || "false" }],
      list_price: [{
        value_with_tax: data.price,
        currency: data.currency || "EUR",
      }],
      power_plug_type: [{ value: data.plugType || "no_plug" }],
      accepted_voltage_frequency: [{ value: data.voltageFrequency || "100v_120v_50hz" }],
    }
  };
}
