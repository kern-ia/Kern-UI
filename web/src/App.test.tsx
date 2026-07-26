import { render, screen } from '@testing-library/react'
import App from './App'

it('renders the product name', () => {
  render(<App />)
  expect(screen.getByText(/Kern-IA/i)).toBeInTheDocument()
})
