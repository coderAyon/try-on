import { SUNGLASSES_CATALOG } from '../src/data/catalog.js';

export default function handler(_req: unknown, res: { status(code: number): { json(value: unknown): void } }) {
  res.status(200).json({ success: true, data: SUNGLASSES_CATALOG });
}
