interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r md:block">
          <div className="flex h-full flex-col">
            <div className="border-b px-6 py-5">
              <p className="font-semibold">RAG Chatbot</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Admin Panel
              </p>
            </div>

            <nav className="flex-1 p-4">
              <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Navigation
              </p>
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center border-b px-6">
            <p className="text-sm font-medium">Administration</p>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}