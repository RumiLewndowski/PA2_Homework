function validatePurchase(body, validCategoryIds) {
  // Reject non-objects, null, or arrays
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid request body' };
  }

  const { name, quantity, unitPriceCents, categoryId } = body;

  // Validate name (non-empty string)
  if (typeof name !== 'string' || name.trim() === '') {
    return { error: 'Invalid name' };
  }

  // Validate quantity: integer, between 1 and 10000 inclusive
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) {
    return { error: 'Invalid quantity' };
  }

  // Validate unitPriceCents: integer, between 1 and 100000000 inclusive
  if (!Number.isInteger(unitPriceCents) || unitPriceCents <= 0 || unitPriceCents > 100000000) {
    return { error: 'Invalid unit price' };
  }

  // Validate categoryId: must exist in validCategoryIds
  if (!Number.isInteger(categoryId) || !validCategoryIds.includes(categoryId)) {
    return { error: 'Invalid category' };
  }

  // Return a fresh sanitized object without mutating the original body
  return {
    value: {
      name: name.trim(),
      quantity: quantity,
      unitPriceCents: unitPriceCents,
      categoryId: categoryId
    }
  };
}

module.exports = { validatePurchase };