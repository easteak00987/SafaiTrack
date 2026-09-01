import { Navbar } from './components/Navbar'
import { HeroSection } from './sections/HeroSection'

function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
      </main>
    </div>
  )
}

export default App