function parseJson(name, value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON when passed as a string`);
  }
}

export function optionalJsonArray(args, name) {
  const value = parseJson(name, args?.[name]);
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${name} must be a JSON array`);
  return value;
}

export function requiredJsonObject(args, name) {
  const value = parseJson(name, args?.[name]);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return value;
}

export function optionalJsonObject(args, name) {
  if (args?.[name] === undefined) return undefined;
  return requiredJsonObject(args, name);
}
