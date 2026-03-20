import { useState } from 'react'
import { AuthContext } from './authContextObject'

function getInitialUser() {
  const savedUser = localStorage.getItem('gigShirudoUser')
  if (!savedUser) {
    return null
  }

  try {
    return JSON.parse(savedUser)
  } catch {
    localStorage.removeItem('gigShirudoUser')
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getInitialUser)

  const register = (userData) => {
    const newUser = {
      id: Date.now().toString(),
      ...userData,
      registeredAt: new Date().toISOString(),
      verified: false,
      payoutEligible: false,
    }
    setUser(newUser)
    localStorage.setItem('gigShirudoUser', JSON.stringify(newUser))
    return newUser
  }

  const login = (email) => {
    // Simulate login - in real app, this would call backend
    const mockUser = {
      id: '123',
      email,
      name: email.split('@')[0],
      platform: 'Zomato',
      city: 'Delhi',
      weeklyIncome: 5000,
      registeredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      verified: false,
      payoutEligible: false,
    }
    setUser(mockUser)
    localStorage.setItem('gigShirudoUser', JSON.stringify(mockUser))
    return mockUser
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('gigShirudoUser')
  }

  const updateUser = (updates) => {
    const updated = { ...user, ...updates }
    setUser(updated)
    localStorage.setItem('gigShirudoUser', JSON.stringify(updated))
  }

  const selectPlan = (plan) => {
    const updated = { ...user, selectedPlan: plan, planSelectedAt: new Date().toISOString() }
    setUser(updated)
    localStorage.setItem('gigShirudoUser', JSON.stringify(updated))
  }

  const applyForVerification = (bankDetails) => {
    const updated = {
      ...user,
      bankDetails,
      verificationApplied: true,
      verificationStatus: 'pending',
      verificationAppliedAt: new Date().toISOString(),
    }
    setUser(updated)
    localStorage.setItem('gigShirudoUser', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        register,
        login,
        logout,
        updateUser,
        selectPlan,
        applyForVerification,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
