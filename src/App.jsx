import { useState } from 'react'
import BookingCalendar from './components/BookingCalendar'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Booking System</h1>
        <BookingCalendar />
      </div>
    </div>
  )
}

export default App
