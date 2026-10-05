// Shared by checkout and the saved-address API so both enforce the same rules.
const validateShippingAddress = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const address = Object.fromEntries(
    ['line1', 'city', 'state', 'pincode', 'phone'].map((key) => [key, String(value[key] || '').trim()])
  );

  if (Object.values(address).some((field) => !field)) return null;
  if (address.line1.length > 180 || address.city.length > 80 || address.state.length > 80) return null;
  if (!/^\d{6}$/.test(address.pincode)) return null;
  if (!/^[0-9+()\-\s]{7,20}$/.test(address.phone)) return null;
  return address;
};

module.exports = { validateShippingAddress };
