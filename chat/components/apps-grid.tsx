"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { getAllApps } from "@/lib/apps.config";

export function AppsGrid() {
  const apps = getAllApps();

  return (
    <div className="min-h-screen bg-neutral-900 text-foreground flex items-center justify-center px-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-100 mb-4">Welcome</h1>
          <p className="text-neutral-400">Choose an app to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app, index) => (
            <Link key={app.id} href={`/${app.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-750 hover:border-neutral-600 transition-all cursor-pointer group">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${app.bgColor} flex items-center justify-center mb-4`}>
                      <app.icon className={`h-6 w-6 ${app.color}`} />
                    </div>
                    <CardTitle className="text-xl text-neutral-100 group-hover:text-white transition-colors">
                      {app.name}
                    </CardTitle>
                    <CardDescription className="text-neutral-400">
                      {app.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">
                      Click to open →
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
