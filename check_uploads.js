import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://yffwujipdmkysltvqjft.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_7V5AHsyId4rWO4AetrcmWg_yu1ZN_5b';

async function listFiles() {
    try {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/list/audio-uploads`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prefix: '',
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Error listing files:', err);
            return;
        }

        const files = await response.json();
        console.log('API Response Status:', response.status);
        console.log('Files found:', files.length);
        if (files.length > 0) {
            console.log('Files in bucket:');
            files.forEach(f => console.log(`- ${f.name} (${f.metadata ? f.metadata.size : 'unknown'} bytes)`));
        } else {
            console.log('Bucket is empty or no files match the prefix.');
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

listFiles();
