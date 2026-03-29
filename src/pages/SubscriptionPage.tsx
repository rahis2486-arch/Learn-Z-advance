import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Sparkles, Zap, Shield, CreditCard, ArrowLeft, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAssistant } from '../contexts/AssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';

const plans = [
  {
    id: "Basic",
    name: "Basic",
    price: "Free",
    description: "Perfect for getting started with AI learning.",
    features: [
      "Access to Nova Assistant (Standard)",
      "5 Neural Memory slots",
      "Basic Math Tutor access",
      "Standard video analysis"
    ],
    buttonText: "Current Plan",
    accent: "border-theme-border"
  },
  {
    id: "Pro",
    name: "Pro",
    price: "रू 999",
    period: "/month",
    description: "For serious students who want the full power of Nova.",
    features: [
      "Priority access to Nova (Advanced)",
      "Unlimited Neural Memory",
      "Advanced Math Tutor with vision",
      "Deep video analysis & summaries",
      "Early access to new features"
    ],
    buttonText: "Upgrade to Pro",
    accent: "border-emerald-500 shadow-lg shadow-emerald-500/10",
    popular: true
  },
  {
    id: "Institution",
    name: "Institution",
    price: "रू 4,999",
    period: "/month",
    description: "Tailored for schools and coaching centers.",
    features: [
      "Everything in Pro",
      "Admin dashboard for teachers",
      "Student progress tracking",
      "Custom curriculum integration",
      "Dedicated support"
    ],
    buttonText: "Contact Sales",
    accent: "border-indigo-500 shadow-lg shadow-indigo-500/10"
  }
];

const paymentMethods = [
  { id: "esewa", name: "eSewa", icon: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Esewa_logo.png" },
  { id: "khalti", name: "Khalti", icon: "https://khalti.com/static/img/logo1.png" },
  { id: "imepay", name: "IME Pay", icon: "https://www.imepay.com.np/wp-content/uploads/2021/07/imepay-logo.png" },
  { id: "fonepay", name: "Fonepay", icon: "https://fonepay.com/wp-content/uploads/2021/06/fonepay-logo.png" }
];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { theme } = useAssistant();
  const { user, refreshUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[0] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select' | 'payment' | 'success'>('select');

  const handleUpgrade = (plan: typeof plans[0]) => {
    if (plan.id === 'Basic') return;
    if (user?.subscription?.plan === plan.id) return;
    setSelectedPlan(plan);
    setStep('select');
  };

  const processPayment = async () => {
    if (!selectedPlan || !selectedMethod || !user) return;
    
    setIsProcessing(true);
    // Simulate payment gateway delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const res = await apiFetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          plan: selectedPlan.id,
          paymentMethod: selectedMethod,
          transactionId: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        })
      });
      
      if (res.ok) {
        await refreshUser();
        setStep('success');
      } else {
        alert("Payment failed. Please try again.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("An error occurred during payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text p-6 lg:p-12">
      <div className="max-w-7xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-theme-text-muted hover:text-theme-text mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-6xl font-black tracking-tighter mb-4"
          >
            Upgrade Your <span className="text-theme-accent">Learning</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-theme-text-muted text-lg max-w-2xl mx-auto"
          >
            Choose the plan that fits your academic goals. Unlock the full potential of Learn-Z and Nova Assistant.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {plans.map((plan, i) => {
            const isCurrent = user?.subscription?.plan === plan.id || (!user?.subscription?.plan && plan.id === 'Basic');
            
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * (i + 1) }}
                className={cn(
                  "relative p-8 rounded-3xl border bg-theme-card backdrop-blur-xl flex flex-col transition-all hover:scale-[1.02]",
                  plan.accent
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-black text-xs font-bold uppercase tracking-widest">
                    Most Popular
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.period && <span className="text-theme-text-muted">{plan.period}</span>}
                  </div>
                  <p className="text-sm text-theme-text-muted mt-4">{plan.description}</p>
                </div>

                <div className="flex-1 space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm">
                      <div className="mt-1 p-0.5 rounded-full bg-theme-accent/20 text-theme-accent">
                        <Check size={12} />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan)}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold transition-all",
                    isCurrent 
                      ? "bg-theme-text/5 text-theme-text-muted cursor-default" 
                      : theme === 'light' 
                        ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20" 
                        : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                  )}
                >
                  {isCurrent ? "Current Plan" : plan.buttonText}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="bg-theme-card border border-theme-border rounded-[2.5rem] p-8 lg:p-12 text-center">
          <h2 className="text-2xl font-bold mb-8">Accepted Nepali Payment Methods</h2>
          <div className="flex flex-wrap justify-center gap-8 lg:gap-16 items-center opacity-70 grayscale hover:grayscale-0 transition-all">
            {paymentMethods.map((method) => (
              <div key={method.name} className="flex flex-col items-center gap-2">
                <img 
                  src={method.icon} 
                  alt={method.name} 
                  className="h-8 lg:h-12 object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-theme-text-muted">{method.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center justify-center gap-8 text-theme-text-muted text-sm">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-theme-accent" />
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-theme-accent" />
              <span>Instant Activation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setSelectedPlan(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-theme-card border border-theme-border rounded-[2rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-theme-border flex items-center justify-between">
                <h3 className="text-xl font-bold">Complete Upgrade</h3>
                <button 
                  onClick={() => !isProcessing && setSelectedPlan(null)}
                  className="p-2 hover:bg-theme-text/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8">
                {step === 'select' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-theme-accent/5 border border-theme-accent/20">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-theme-text-muted">Selected Plan</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-theme-accent">Monthly</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xl font-bold">{selectedPlan.name}</span>
                        <span className="text-2xl font-black">{selectedPlan.price}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-theme-text-muted mb-4 block">
                        Select Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {paymentMethods.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => setSelectedMethod(method.id)}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex flex-col items-center gap-3",
                              selectedMethod === method.id
                                ? "border-theme-accent bg-theme-accent/10"
                                : "border-theme-border hover:border-theme-text/20 bg-theme-text/5"
                            )}
                          >
                            <img src={method.icon} alt={method.name} className="h-8 object-contain" referrerPolicy="no-referrer" />
                            <span className="text-xs font-bold">{method.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={!selectedMethod}
                      onClick={() => setStep('payment')}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold transition-all mt-4",
                        selectedMethod
                          ? theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                          : "bg-theme-text/5 text-theme-text-muted cursor-not-allowed"
                      )}
                    >
                      Continue to Payment
                    </button>
                  </div>
                )}

                {step === 'payment' && (
                  <div className="text-center py-8">
                    {!isProcessing ? (
                      <>
                        <div className="w-20 h-20 rounded-full bg-theme-accent/10 flex items-center justify-center mx-auto mb-6">
                          <CreditCard size={32} className="text-theme-accent" />
                        </div>
                        <h4 className="text-xl font-bold mb-2">Confirm Payment</h4>
                        <p className="text-theme-text-muted mb-8">
                          You are about to pay <span className="text-theme-text font-bold">{selectedPlan.price}</span> via {paymentMethods.find(m => m.id === selectedMethod)?.name}.
                        </p>
                        <div className="flex gap-4">
                          <button
                            onClick={() => setStep('select')}
                            className="flex-1 py-4 rounded-2xl font-bold border border-theme-border hover:bg-theme-text/5 transition-all"
                          >
                            Back
                          </button>
                          <button
                            onClick={processPayment}
                            className={cn(
                              "flex-1 py-4 rounded-2xl font-bold transition-all",
                              theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                            )}
                          >
                            Pay Now
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-12">
                        <Loader2 size={48} className="text-theme-accent animate-spin mb-6" />
                        <h4 className="text-xl font-bold mb-2">Processing Payment</h4>
                        <p className="text-theme-text-muted">Please do not close this window...</p>
                      </div>
                    )}
                  </div>
                )}

                {step === 'success' && (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                      <Sparkles size={32} className="text-emerald-500" />
                    </div>
                    <h4 className="text-2xl font-black mb-2">Welcome to {selectedPlan.name}!</h4>
                    <p className="text-theme-text-muted mb-8">
                      Your subscription has been activated successfully. Enjoy all the premium features of Learn-Z.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedPlan(null);
                        navigate('/classroom');
                      }}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold transition-all",
                        theme === 'light' ? "bg-indigo-600 text-white" : "bg-emerald-500 text-black"
                      )}
                    >
                      Go to Classroom
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
