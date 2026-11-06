import multer from 'multer';
import { env } from '../config/env';
import { badRequest } from '../common/errors';

const DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

/** Magic-byte tekshiruvi: kengaytma/mime soxtalashtirilmaganini tekshiradi */
export function sniffOk(buf: Buffer, mime: string) {
  const h = buf.subarray(0, 8);
  if (mime === 'application/pdf') return h.subarray(0, 4).toString() === '%PDF';
  if (mime === 'image/png') return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
  if (mime === 'image/jpeg') return h[0] === 0xff && h[1] === 0xd8;
  if (mime === 'image/webp') return buf.subarray(8, 12).toString() === 'WEBP';
  if (mime.includes('openxmlformats')) return h[0] === 0x50 && h[1] === 0x4b; // zip
  if (['application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel'].includes(mime))
    return h[0] === 0xd0 && h[1] === 0xcf;
  if (mime === 'text/plain') return !buf.subarray(0, 512).includes(0);
  return false;
}

function make(allowed: string[]) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.includes(file.mimetype)) return cb(badRequest('FILE_TYPE', 'Ruxsat etilmagan fayl turi'));
      cb(null, true);
    },
  });
}

export const uploadImage = make(IMAGES);
export const uploadDoc = make([...DOCS, ...IMAGES]);

export function assertSniff(file?: Express.Multer.File) {
  if (!file) throw badRequest('FILE_REQUIRED', 'Fayl tanlanmagan');
  if (!sniffOk(file.buffer, file.mimetype)) throw badRequest('FILE_CONTENT', 'Fayl mazmuni turiga mos emas');
}
