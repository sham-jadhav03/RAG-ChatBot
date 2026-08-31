"use client";

import { useAuth } from "@/components/hooks/useAuth";
import { ApiError } from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminRegisterPage() {
    const router = useRouter()

    const { register } = useAuth()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [username, setUsername] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setError("")
        setIsSubmitting(true);

        try {
            await register({ username, email, password });
            router.replace("/admin");
        } catch (error) {
            if (error instanceof ApiError) {
                setError(error.message);
            } else {
                setError("Unable to register. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="mb-8">
                    <p className="text-sm font-medium text-muted-foreground">
                        RAG Chatbot
                    </p>

                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        Admin Register
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Create an account to manage your document knowledge base.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-medium">
                            Username
                        </label>

                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="Enter username"
                            suppressHydrationWarning
                            required
                            disabled={isSubmitting}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">
                            Email
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="admin@example.com"
                            suppressHydrationWarning
                            required
                            disabled={isSubmitting}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium">
                            Password
                        </label>

                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter password"
                            suppressHydrationWarning
                            required
                            disabled={isSubmitting}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        suppressHydrationWarning
                        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? "Registering..." : "Register"}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/admin/login" className="font-medium text-primary hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </main>
    );
}
