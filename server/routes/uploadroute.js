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

    
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 1 * 1024 * 1024, 
        }
    });

    fastify.post('/upload', async (request, reply) => {
        try {
            console.log('📤 Upload request received');

            
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

            
            if (!data.mimetype.startsWith('image/')) {
                return reply.status(400).send({ error: 'Only image files are allowed' });
            }

            
            const buffer = await data.toBuffer();
            
            
            if (buffer.length > 1 * 1024 * 1024) {
                return reply.status(400).send({ error: 'File size exceeds 1MB limit' });
            }

            
            const ext = data.filename.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

            
            const uploadDir = path.join(process.cwd(), 'uploads');
            
            
            try {
                await fs.access(uploadDir);
            } catch {
                console.log('📁 Creating uploads directory...');
                await fs.mkdir(uploadDir, { recursive: true });
            }

            
            const filePath = path.join(uploadDir, fileName);
            await fs.writeFile(filePath, buffer);

            console.log('✅ File saved successfully to shared volume:', fileName);

            
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