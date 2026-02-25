import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Globe, Users, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-900">FHI Global</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-slate-600 hover:text-slate-900 transition">About</a>
            <a href="#services" className="text-slate-600 hover:text-slate-900 transition">Services</a>
            <a href="#impact" className="text-slate-600 hover:text-slate-900 transition">Impact</a>
            <Button variant="default" className="bg-blue-600 hover:bg-blue-700">Contact Us</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 text-balance">
          Advancing Global Health Together
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto text-pretty">
          FHI Global is committed to improving health outcomes worldwide through innovative research, strategic partnerships, and evidence-based interventions.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
          <Button size="lg" variant="outline">Learn More</Button>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Our Mission</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Heart className="w-8 h-8 text-red-500 mb-2" />
              <CardTitle>Health Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">We believe everyone deserves access to quality healthcare and health information, regardless of location or circumstance.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Zap className="w-8 h-8 text-yellow-500 mb-2" />
              <CardTitle>Innovation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">We leverage cutting-edge research and technology to develop sustainable solutions for global health challenges.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Users className="w-8 h-8 text-green-500 mb-2" />
              <CardTitle>Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">We work with governments, NGOs, and communities to create lasting impact through strategic partnerships.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Our Services</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Research & Development</h3>
            <p className="text-slate-600">Conducting rigorous research on infectious diseases, maternal health, and health systems strengthening.</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Program Implementation</h3>
            <p className="text-slate-600">Designing and implementing evidence-based programs that deliver measurable health outcomes.</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Training & Capacity Building</h3>
            <p className="text-slate-600">Empowering healthcare workers and communities with knowledge and skills for better health outcomes.</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Policy & Advocacy</h3>
            <p className="text-slate-600">Influencing evidence-based policy changes that advance global health at regional and international levels.</p>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Our Impact</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600 mb-2">50+</p>
            <p className="text-slate-600">Countries Served</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600 mb-2">10M+</p>
            <p className="text-slate-600">Lives Impacted</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600 mb-2">100+</p>
            <p className="text-slate-600">Research Studies</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600 mb-2">500+</p>
            <p className="text-slate-600">Team Members</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">Join Us in Our Mission</h2>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
          Whether you're a partner organization, researcher, or someone passionate about global health, we'd love to work with you.
        </p>
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700">Get In Touch</Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Globe className="w-6 h-6 text-blue-600" />
              <span className="font-semibold text-slate-900">FHI Global</span>
            </div>
            <p className="text-slate-600 text-sm">© 2026 FHI Global. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="text-slate-600 hover:text-slate-900 text-sm transition">Privacy</a>
              <a href="#" className="text-slate-600 hover:text-slate-900 text-sm transition">Terms</a>
              <a href="#" className="text-slate-600 hover:text-slate-900 text-sm transition">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
