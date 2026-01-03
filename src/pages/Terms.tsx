import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Book, Mail, Globe } from "lucide-react";
import { useForceLightMode } from "@/hooks/useForceLightMode";

const Terms = () => {
  useForceLightMode();

  useEffect(() => {
    document.title = "MarkIt | Terms of Service";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-home-background font-lexend force-light-mode">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <Book className="w-5 h-5 text-home-primary" />
            </div>
            <span className="text-xl font-bold text-home-foreground">MarkIt</span>
          </Link>
          
          <Link to="/">
            <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Terms of Service Content */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-12">
              <h1 className="text-4xl lg:text-5xl font-bold text-home-foreground mb-4">
                MarkIt: Terms of Service
              </h1>
              <p className="text-lg text-gray-600">
                Last updated: January 2nd, 2025
              </p>
            </div>

            {/* Introduction */}
            <div className="prose prose-lg max-w-none mb-12">
              <p className="text-gray-700 leading-relaxed">
                These Terms of Service ("Terms") govern your use of MarkIt.
              </p>
              <p className="text-gray-700 leading-relaxed font-semibold">
                By accessing or using the Service, you agree to these Terms.
              </p>
            </div>

            {/* Section 1 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">1. Eligibility</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                You must be at least 13 years old to use MarkIt.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By using the Service, you confirm you meet this requirement.
              </p>
            </div>

            {/* Section 2 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">2. Your Account</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>You are responsible for maintaining account security.</li>
                <li>You agree to provide accurate information.</li>
                <li>You may not share accounts or impersonate others.</li>
                <li>We may suspend or terminate accounts that violate these Terms.</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">3. Acceptable Use</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Harass, threaten, or abuse others</li>
                <li>Share illegal, harmful, or explicit content</li>
                <li>Attempt to reverse-engineer or exploit the platform</li>
                <li>Use MarkIt for cheating, plagiarism, or academic dishonesty</li>
                <li>Interfere with system performance or security</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to moderate content and behavior.
              </p>
            </div>

            {/* Section 4 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">4. Educational Disclaimer</h2>
              <ul className="list-disc list-inside space-y-3 text-gray-700 ml-4">
                <li>MarkIt provides learning tools and AI-assisted support for educational purposes only.</li>
                <li>AI responses may be inaccurate or incomplete.</li>
                <li>You are responsible for verifying information.</li>
                <li>MarkIt is not liable for academic, legal, or professional outcomes.</li>
              </ul>
            </div>

            {/* Section 5 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">5. User Content</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You retain ownership of content you create or upload.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                By using MarkIt, you grant us a limited license to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Host, display, and process content to provide the Service</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                You are responsible for ensuring you have rights to content you upload.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">6. Voice & Collaboration Features</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Real-time features are provided "as-is."
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                We are not responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Interruptions or technical issues</li>
                <li>Content shared by other users during live sessions</li>
              </ul>
            </div>

            {/* Section 7 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">7. Termination</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You may delete your account at any time.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may suspend or terminate access if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>These Terms are violated</li>
                <li>Required by law or safety concerns</li>
              </ul>
            </div>

            {/* Section 8 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">8. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                To the fullest extent permitted by law:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>MarkIt is not liable for indirect or consequential damages</li>
                <li>Use of the Service is at your own risk</li>
              </ul>
            </div>

            {/* Section 9 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">9. Changes to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update these Terms. Continued use of MarkIt means you accept updated Terms.
              </p>
            </div>

            {/* Section 10 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">10. Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms are governed by the laws of the State of Texas, unless otherwise required.
              </p>
            </div>

            {/* Section 11 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">11. Contact</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-home-primary" />
                  <a 
                    href="mailto:markit.contact1@gmail.com" 
                    className="text-home-primary hover:underline font-semibold text-lg"
                  >
                    markit.contact1@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-home-primary" />
                  <a 
                    href="https://markit.chat" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-home-primary hover:underline font-semibold text-lg"
                  >
                    https://markit.chat
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-home-surface py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center gap-1.5 mb-4 md:mb-0">
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary" />
              </div>
              <span className="text-xl font-bold text-home-foreground">MarkIt</span>
            </Link>
            
            <div className="flex gap-6 text-sm text-gray-600">
              <Link to="/privacy" className="hover:text-home-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-home-foreground transition-colors font-semibold">Terms</Link>
              <a href="mailto:markit.contact1@gmail.com" className="hover:text-home-foreground transition-colors">Support</a>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
            © 2025 MarkIt. Building the future of collaborative learning.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;

