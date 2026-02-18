"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrdersRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/orders/history');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-gray-500">Redirecionando...</p>
        </div>
    );
}
