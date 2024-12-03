import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, startOfDay, getWeek, startOfWeek, endOfWeek, isBefore, isAfter, parseISO } from 'date-fns';
import axios from 'axios';

const timeSlots = [
  { start: '08:00', end: '13:00' },
  { start: '13:00', end: '18:00' },
  { start: '18:00', end: '22:00' },
];

const MAX_USERS = 10;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function BookingCalendar() {
  const [showingDays, setShowingDays] = useState([]);
  const [users, setUsers] = useState({}); // password -> id mapping
  const [bookings, setBookings] = useState({}); // slotKey -> booking mapping
  const [nextUserId, setNextUserId] = useState(1);
  const [bookingPeriod, setBookingPeriod] = useState({ start: null, end: null });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    updateVisibleDays();
    loadState();
  }, []);

  const updateVisibleDays = () => {
    const today = startOfDay(new Date());
    console.log('Today:', format(today, 'yyyy-MM-dd'));
    
    // Find the start of the current week
    let firstWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    console.log('First week start:', format(firstWeekStart, 'yyyy-MM-dd'));
    
    // Generate 3 weeks of days
    const days = [];
    for (let i = 0; i < 21; i++) {
      days.push(addDays(firstWeekStart, i));
    }

    // Set booking period (today through end of second full week from today)
    const secondWeekEnd = addDays(today, 13); // 13 days = today + next 13 days = 14 days total
    console.log('Second week end:', format(secondWeekEnd, 'yyyy-MM-dd'));
    
    setBookingPeriod({
      start: today,
      end: secondWeekEnd
    });
    
    // Group days by week
    const weekGroups = days.reduce((groups, day) => {
      const weekNum = getWeek(day, { weekStartsOn: 1 });
      if (!groups[weekNum]) {
        groups[weekNum] = [];
      }
      groups[weekNum].push(day);
      return groups;
    }, {});

    setShowingDays(Object.values(weekGroups));
  };

  const loadState = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings`);
      const { users, bookings, nextUserId } = response.data;
      setUsers(users);
      setBookings(bookings);
      setNextUserId(nextUserId);
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  };

  const saveState = async (newUsers, newBookings, newNextUserId) => {
    try {
      await axios.post(`${API_URL}/bookings`, {
        users: newUsers,
        bookings: newBookings,
        nextUserId: newNextUserId
      });
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  };

  const findUserByPassword = (password) => {
    return Object.entries(users).find(([_, storedPassword]) => storedPassword === password);
  };

  const handleSlotClick = async (date, slot) => {
    // Step 1: Get user credentials
    const password = prompt('Enter your password:');
    if (!password) return;

    // Step 2: Check if user exists and get their ID
    let userId = Object.entries(users).find(([id, pwd]) => pwd === password)?.[0];
    if (!userId) {
      if (Object.keys(users).length >= MAX_USERS) {
        alert('Maximum number of users reached');
        return;
      }
      userId = nextUserId.toString();
      try {
        await axios.post(`${API_URL}/users`, { userId, password });
      } catch (error) {
        alert('Failed to create user');
        return;
      }
    }

    // Check if user already has a booking
    const existingBooking = Object.entries(bookings).find(([_, booking]) => booking.userId === parseInt(userId));
    if (existingBooking) {
      const [_, booking] = existingBooking;
      const bookingDate = parseISO(booking.date);
      const replace = window.confirm(
        `You already have a booking for ${format(bookingDate, 'eeee, MMM d')} at ${booking.slot.start}-${booking.slot.end}. Would you like to replace it?`
      );
      if (!replace) return;
    }

    // Step 3: Try to book the new slot
    const slotKey = `${format(date, 'yyyy-MM-dd')}-${slot.start}`;
    
    // Check if slot is taken by another user
    if (bookings[slotKey] && bookings[slotKey].userId !== parseInt(userId)) {
      alert('This slot is already taken');
      return;
    }

    try {
      await axios.post(`${API_URL}/bookings`, {
        userId: parseInt(userId),
        date: format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        slot,
        slotKey
      });
    } catch (error) {
      alert('Failed to book slot');
    }
  };

  const getBookingForSlot = (date, slot) => {
    const slotKey = `${format(date, 'yyyy-MM-dd')}-${slot.start}`;
    const booking = bookings[slotKey];
    if (booking) {
      return {
        ...booking,
        date: parseISO(booking.date)
      };
    }
    return booking;
  };

  const isSlotDisabled = (date) => {
    const slotDay = startOfDay(date);
    const today = startOfDay(new Date());
    const disabled = isBefore(slotDay, today) || isAfter(slotDay, bookingPeriod.end);
    if (disabled) {
      console.log('Disabled date:', format(slotDay, 'yyyy-MM-dd'), 
                 'Before today:', isBefore(slotDay, today),
                 'After end:', isAfter(slotDay, bookingPeriod.end));
    }
    return disabled;
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleReset = async () => {
    try {
      const response = await axios.post(`${API_URL}/reset`);
      if (response.data) {
        setBookings(response.data.bookings);
      }
    } catch (error) {
      console.error('Failed to reset bookings:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Booking Calendar</h2>
        <div className="space-x-2">
          {currentUser && (
            <>
              <button
                onClick={handleReset}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              >
                Reset All Bookings
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mb-4 p-4 bg-blue-100 rounded-lg">
        <h3 className="font-semibold">System Status</h3>
        <p>Available user slots: {MAX_USERS - (nextUserId - 1)} of {MAX_USERS}</p>
      </div>
      
      <div className="flex">
        {/* Time slots column */}
        <div className="pr-4 pt-14">
          {timeSlots.map((slot) => (
            <div key={slot.start} className="h-16 flex items-center text-sm text-gray-600">
              {slot.start} - {slot.end}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-1 gap-4">
          {showingDays.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-4">
              {week.map((date) => (
                <div
                  key={format(date, 'yyyy-MM-dd')}
                  className="border rounded-lg p-2"
                >
                  <h3 className="font-semibold text-sm mb-2">
                    {format(date, 'eeee, MMM d')}
                  </h3>
                  <div className="space-y-2">
                    {timeSlots.map((slot) => {
                      const booking = getBookingForSlot(date, slot);
                      const disabled = isSlotDisabled(date);
                      return (
                        <button
                          key={`${format(date, 'yyyy-MM-dd')}-${slot.start}`}
                          onClick={() => !disabled && handleSlotClick(date, slot)}
                          disabled={disabled}
                          className={`w-full h-12 rounded ${
                            disabled
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : booking
                                ? 'bg-gray-200 text-gray-600'
                                : 'bg-green-100 hover:bg-green-200 text-green-800'
                          }`}
                        >
                          {booking && (
                            <div className="flex items-center justify-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                              </svg>
                              {booking.userId}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
