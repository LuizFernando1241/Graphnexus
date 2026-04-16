import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Network } from "lucide-react";
import { toast } from "sonner";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      
      if (!isMounted.current) return;
      
      if (error) {
        toast.error(error.message);
        setLoading(false);
      } else {
        toast.success("Conta criada! Verifique seu email para confirmar o cadastro.");
        setLoading(false);
      }
    } catch {
      if (isMounted.current) {
        toast.error("Erro inesperado ao criar conta");
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Network className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">NexusGraph</h1>
          <p className="text-sm text-muted-foreground">Crie sua conta</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4" aria-describedby="signup-desc">
          <p id="signup-desc" className="sr-only">Formulário de cadastro. Insira seu email e uma senha com no mínimo 6 caracteres.</p>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando conta..." : "Cadastrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
