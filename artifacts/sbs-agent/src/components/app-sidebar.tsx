import { Link, useLocation } from "wouter";
import { MessageSquare, Library, Settings, LogOut, PhoneCall } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="p-4 flex items-center justify-center border-b">
        <div className="flex items-center gap-3 w-full">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <PhoneCall className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground group-data-[collapsible=icon]:hidden truncate">
            SBS Agent
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/"}
                  tooltip="AI Generator"
                >
                  <Link href="/">
                    <MessageSquare />
                    <span>AI Generator</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/spiels"}
                  tooltip="Saved Spiels"
                >
                  <Link href="/spiels">
                    <Library />
                    <span>Saved Spiels</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Agent Profile">
              <div className="flex items-center gap-3 cursor-pointer">
                <Avatar className="h-8 w-8 rounded-md">
                  <AvatarFallback className="bg-primary/10 text-primary rounded-md">
                    AG
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
                  <span className="text-sm font-medium leading-none truncate">
                    Agent Smith
                  </span>
                  <span className="text-xs text-muted-foreground truncate mt-1">
                    Level 2 Support
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
