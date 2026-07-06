import React from 'react';

function CurrencyInput({ value, onChange, placeholder, required, style, disabled, className }) {
  // Format the number to Indonesian Rupiah format
  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '') return '';
    let cleanVal = val;
    if (typeof val === 'string' || typeof val === 'number') {
      const floatVal = parseFloat(val);
      if (!isNaN(floatVal)) {
        cleanVal = Math.round(floatVal).toString();
      }
    }
    const numericValue = cleanVal.toString().replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    return 'Rp' + parseInt(numericValue, 10).toLocaleString('id-ID');
  };

  const handleChange = (e) => {
    const rawValue = e.target.value;
    // Extract only digits
    const numericValue = rawValue.replace(/[^0-9]/g, '');
    // Pass the raw numeric string to the parent (or empty string if none)
    onChange(numericValue);
  };

  return (
    <input
      type="text"
      value={formatCurrency(value)}
      onChange={handleChange}
      placeholder={placeholder || "Rp..."}
      required={required}
      style={style}
      disabled={disabled}
      className={className}
    />
  );
}

export default CurrencyInput;
