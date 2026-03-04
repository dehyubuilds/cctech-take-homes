import multer from 'multer'
import { callNodeListener } from 'h3'

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, "upload")
  },

  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/gif", "video/mp4", "video/quicktime"];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('MIME'));
    }
  }
});

export default defineEventHandler(async (event) => {
  try {
    await callNodeListener(upload.single('file'), event.node.req, event.node.res)
    return { success: true }
  } catch (e) {
    return createError({
      message: e.message,
      statusCode: 422,
      statusMessage: 'Unprocessable Entity'
    })
  }
})
