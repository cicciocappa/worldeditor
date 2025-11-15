/**
 * ChunkIO.js - Save and load chunk data to/from JSON files
 * Handles file download and upload via browser APIs
 */

export class ChunkIO {
    /**
     * Save chunk to JSON file (download to user's computer)
     */
    static saveChunk(chunk, filename = 'chunk.json') {
        try {
            // Serialize chunk to JSON
            const data = chunk.toJSON();
            const jsonString = JSON.stringify(data, null, 2);

            // Create blob and download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();

            URL.revokeObjectURL(url);

            console.log('Chunk saved successfully:', filename);
            return true;
        } catch (error) {
            console.error('Error saving chunk:', error);
            return false;
        }
    }

    /**
     * Load chunk from JSON file (user file picker)
     * Returns a promise that resolves with the chunk data
     */
    static loadChunk(chunk) {
        return new Promise((resolve, reject) => {
            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);

                        // Validate data
                        if (!data.version || !data.heights) {
                            throw new Error('Invalid chunk file format');
                        }

                        // Load into chunk
                        chunk.fromJSON(data);

                        console.log('Chunk loaded successfully');
                        resolve(data);
                    } catch (error) {
                        console.error('Error parsing chunk file:', error);
                        reject(error);
                    }
                };

                reader.onerror = () => {
                    reject(new Error('Error reading file'));
                };

                reader.readAsText(file);
            };

            // Trigger file picker
            input.click();
        });
    }

    /**
     * Export chunk to localStorage for quick save/load during development
     */
    static quickSave(chunk, slot = 'default') {
        try {
            const data = chunk.toJSON();
            const key = `styloworld_chunk_${slot}`;
            localStorage.setItem(key, JSON.stringify(data));
            console.log('Quick save successful:', slot);
            return true;
        } catch (error) {
            console.error('Quick save error:', error);
            return false;
        }
    }

    /**
     * Import chunk from localStorage
     */
    static quickLoad(chunk, slot = 'default') {
        try {
            const key = `styloworld_chunk_${slot}`;
            const jsonString = localStorage.getItem(key);

            if (!jsonString) {
                console.warn('No quick save found:', slot);
                return false;
            }

            const data = JSON.parse(jsonString);
            chunk.fromJSON(data);

            console.log('Quick load successful:', slot);
            return true;
        } catch (error) {
            console.error('Quick load error:', error);
            return false;
        }
    }
}
