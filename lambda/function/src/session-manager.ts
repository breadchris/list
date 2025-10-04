import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';

export interface SessionFile {
	path: string;
	content: Uint8Array;
}

export class SessionManager {
	private s3Client: S3Client;
	private bucketName: string;

	constructor(bucketName: string, region: string = 'us-east-1') {
		this.bucketName = bucketName;
		this.s3Client = new S3Client({ region });
	}

	/**
	 * Download and decompress a session from S3 storage
	 */
	async downloadSession(session_id: string): Promise<SessionFile[]> {
		const zipKey = `${session_id}.zip`;

		try {
			// Download from S3
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: zipKey
			});

			const response = await this.s3Client.send(command);

			if (!response.Body) {
				throw new Error(`Session ${session_id} not found in storage`);
			}

			// Convert stream to buffer
			const zipData = await response.Body.transformToByteArray();

			// Decompress using JSZip
			const zip = await JSZip.loadAsync(zipData);

			// Extract all files
			const files: SessionFile[] = [];
			for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
				if (!zipEntry.dir) {
					const content = await zipEntry.async('uint8array');
					files.push({
						path: relativePath,
						content
					});
				}
			}

			return files;
		} catch (error) {
			if (error instanceof Error && error.name === 'NoSuchKey') {
				throw new Error(`Session ${session_id} not found in storage`);
			}
			throw error;
		}
	}

	/**
	 * Compress and upload a session to S3 storage
	 */
	async uploadSession(session_id: string, files: SessionFile[]): Promise<string> {
		const zip = new JSZip();

		// Add all files to zip
		for (const file of files) {
			zip.file(file.path, file.content);
		}

		// Generate zip blob
		const zipBlob = await zip.generateAsync({
			type: 'uint8array',
			compression: 'DEFLATE',
			compressionOptions: {
				level: 6
			}
		});

		// Upload to S3
		const zipKey = `${session_id}.zip`;
		const command = new PutObjectCommand({
			Bucket: this.bucketName,
			Key: zipKey,
			Body: zipBlob,
			ContentType: 'application/zip',
			Metadata: {
				created_at: new Date().toISOString(),
				file_count: files.length.toString()
			}
		});

		await this.s3Client.send(command);

		return zipKey;
	}

	/**
	 * Check if a session exists in S3 storage
	 */
	async sessionExists(session_id: string): Promise<boolean> {
		const zipKey = `${session_id}.zip`;

		try {
			const command = new HeadObjectCommand({
				Bucket: this.bucketName,
				Key: zipKey
			});

			await this.s3Client.send(command);
			return true;
		} catch (error) {
			if (error instanceof Error && error.name === 'NotFound') {
				return false;
			}
			throw error;
		}
	}

	/**
	 * Delete a session from S3 storage
	 */
	async deleteSession(session_id: string): Promise<void> {
		const zipKey = `${session_id}.zip`;

		const command = new DeleteObjectCommand({
			Bucket: this.bucketName,
			Key: zipKey
		});

		await this.s3Client.send(command);
	}
}
