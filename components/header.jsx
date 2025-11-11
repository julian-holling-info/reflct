import React from "react";

//  NextJS components
import Link from "next/link";
import Image from "next/image";

//  UI Components
import { Button } from "./ui/button";
import { PenBox, FolderOpen } from "lucide-react";

//  Clerk (Auth handler) component
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

//  Custom components
import UserMenu from "./user-menu";

import { checkUser } from "@/lib/checkUser";

/*********************************************************************************************
 * THE HEADER COMPONENT STARTS HERE
 *********************************************************************************************/

const Header = async() => {

    await checkUser();

    return (
        <header className="container mx-auto">
            <nav className="py-6 px-4 flex justify-between">
                <Link href={"/"}>
                    <Image 
                        src={'/logo.png'} 
                        alt="Reflct Logo" 
                        width={200} 
                        height={60}
                        className="h-19 -w-auto object-contain" 
                    />
                </Link>

                <div className="flex items-center gap-4">
                    
                    <SignedIn>
                        <Link href="/dashboard#collections">
                        <Button variant="outline" className="flex items-center gap-2">
                            <FolderOpen size={18} />
                            <span className="hidden md:inline">Collections</span>
                        </Button>
                    </Link>
                    </SignedIn>

                    <Link href="/journal/write">
                        <Button variant="journal" className="flex items-center gap-2">
                            <PenBox size={18} />
                            <span className="hidden md:inline">Write New</span>
                        </Button>
                    </Link>

                    <SignedOut>
                        <SignInButton forceRedirectUrl="/dashboard">
                            <Button variant="outline">
                                Login
                            </Button>
                        </SignInButton>
                    </SignedOut>

                    <SignedIn>
                        <UserMenu />
                    </SignedIn>
                </div>
            </nav>
        </header>
    )
}

export default Header