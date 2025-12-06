import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import fastifyMultipart from '@fastify/multipart';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECRET = process.env.JWT_SECRET;

export default async function uploadRoute(fastify, opts) {
    const db = opts.db;
    const io = opts.io;

    // Register multipart plugin to handle file uploads
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 1 * 1024 * 1024, // 1MB max file size
        }
    });

    fastify.post('/upload', async (request, reply) => {
        try {
            console.log('📤 Upload request received');

            // Authenticate user from cookie
            const token = request.cookies?.token;
            if (!token) {
                console.error('❌ No authentication token');
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId;
            try {
                const decoded = jwt.verify(token, SECRET);
                userId = decoded.userId || decoded.id;
            } catch (err) {
                console.error('❌ Invalid token:', err);
                return reply.status(401).send({ error: 'Unauthorized' });
            }

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

            // Validate file type (images only)
            if (!data.mimetype.startsWith('image/')) {
                return reply.status(400).send({ error: 'Only image files are allowed' });
            }

            // Read file buffer
            const buffer = await data.toBuffer();
            
            // Validate file size (1MB max)
            if (buffer.length > 1 * 1024 * 1024) {
                return reply.status(400).send({ error: 'File size exceeds 1MB limit' });
            }

            // Create random filename with extension
            const ext = data.filename.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

            // Use the shared uploads volume mounted at /usr/src/app/uploads
            const uploadDir = path.join(process.cwd(), 'uploads');
            
            // Create uploads directory if it doesn't exist
            try {
                await fs.access(uploadDir);
            } catch {
                console.log('📁 Creating uploads directory...');
                await fs.mkdir(uploadDir, { recursive: true });
            }

            // Save file to shared volume
            const filePath = path.join(uploadDir, fileName);
            await fs.writeFile(filePath, buffer);

            console.log('✅ File saved successfully to shared volume:', fileName);

            // Update user's picture in database
            const fileUrl = `/uploads/${fileName}`;
            
            return new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users SET picture = ? WHERE id = ?`,
                    [fileUrl, userId],
                    function(err) {
                        if (err) {
                            console.error('❌ Database update error:', err);
                            reply.status(503).send({ error: 'Failed to update profile picture' });
                            return reject(err);
                        }

                        console.log('✅ Database updated for user:', userId);

                        // Broadcast profile update via Socket.IO
                        if (io) {
                            io.emit('profileUpdated', {
                                userId: userId,
                                picture: fileUrl
                            });
                            console.log('📡 Profile update broadcasted');
                        }

                        reply.send({ 
                            success: true,
                            url: fileUrl,
                            message: 'Profile picture updated successfully'
                        });
                        resolve();
                    }
                );
            });

        } catch (error) {
            console.error('❌ Upload error:', error);
            return reply.status(422).send({ error: 'Upload failed', details: error.message });
        }
    });
}