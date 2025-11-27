import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import fastifyMultipart from '@fastify/multipart';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function uploadRoute(fastify, opts) {
    // Register multipart plugin to handle file uploads
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max file size
        }
    });

    fastify.post('/upload', async (request, reply) => {
        try {
            console.log('📤 Upload request received');

            // Get the uploaded file
            const data = await request.file();
            
            if (!data) {
                console.error('❌ No file uploaded');
                return reply.status(400).send({ error: 'No file uploaded' });
            }

            console.log('📁 File details:', {
                filename: data.filename,
                mimetype: data.mimetype,
                encoding: data.encoding
            });

            // Read file buffer
            const buffer = await data.toBuffer();

            // Create random filename with extension
            const ext = data.filename.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

            // Define upload directory path (relative to project root)
            const uploadDir = path.join(process.cwd(), '../', 'client', 'public', 'uploads');
            
            // Create uploads directory if it doesn't exist
            try {
                await fs.access(uploadDir);
            } catch {
                console.log('📁 Creating uploads directory...');
                await fs.mkdir(uploadDir, { recursive: true });
            }

            // Save file
            const filePath = path.join(uploadDir, fileName);
            await fs.writeFile(filePath, buffer);

            console.log('✅ File saved successfully:', fileName);

            // Return public URL
            const fileUrl = `/uploads/${fileName}`;
            return reply.send({ url: fileUrl });

        } catch (error) {
            console.error('❌ Upload error:', error);
            return reply.status(500).send({ error: 'Upload failed', details: error.message });
        }
    });
}
