import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');

// Load bookings from file
async function loadBookings() {
    try {
        const data = await fs.readFile(BOOKINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Create initial state with some test users
            const initialState = {
                users: {
                    "1": "test1",
                    "2": "test2"
                },
                bookings: {},
                nextUserId: 3
            };
            await fs.writeFile(BOOKINGS_FILE, JSON.stringify(initialState, null, 2));
            return initialState;
        }
        throw error;
    }
}

// Save bookings to file
async function saveBookings(data) {
    await fs.writeFile(BOOKINGS_FILE, JSON.stringify(data, null, 2));
}

// Get current state
app.get('/api/bookings', async (req, res) => {
    try {
        const data = await loadBookings();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load bookings' });
    }
});

// Update state
app.post('/api/bookings', async (req, res) => {
    try {
        const data = await loadBookings();
        const { userId, date, slot, slotKey } = req.body;
        
        // Check if user already has a booking
        const hasExistingBooking = Object.values(data.bookings).some(
            booking => booking.userId === userId
        );
        
        if (hasExistingBooking) {
            return res.status(400).json({ error: 'User already has a booking' });
        }
        
        // Update bookings
        data.bookings[slotKey] = {
            userId,
            date,
            slot
        };
        
        await saveBookings(data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save booking' });
    }
});

// Add new user
app.post('/api/users', async (req, res) => {
    try {
        const data = await loadBookings();
        const { userId, password } = req.body;
        
        // Add new user
        data.users[userId] = password;
        data.nextUserId = parseInt(userId) + 1;
        
        await saveBookings(data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Reset bookings (keeping users)
app.post('/api/reset', async (req, res) => {
    try {
        const data = await loadBookings();
        // Keep users but reset bookings
        data.bookings = {};
        await saveBookings(data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset bookings' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
