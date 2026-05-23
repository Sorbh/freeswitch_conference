import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useFetch } from "@/hooks/useFetch";
import { ROOM_NAMES, timeAgo } from "@/lib/constants";
import {
  MicIcon,
  MicOffIcon,
  RefreshCwIcon,
  ArrowRightLeftIcon,
  SearchIcon,
} from "lucide-react";

function getStatusDot(user) {
  if (user.connectionState === "connected") return "bg-green-500";
  if (user.online) return "bg-yellow-500";
  return "bg-zinc-500";
}

function getStatusLabel(user) {
  if (user.connectionState === "connected") return "Connected";
  if (user.online) return "Online";
  return "Offline";
}

function formatDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleString();
}

export default function UsersPage() {
  const { data, loading, refetch } = useFetch("/api/v1/admin/users", 15000);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [actionUser, setActionUser] = useState(null);

  const users = Array.isArray(data) ? data : [];
  const filtered = users.filter(
    (u) =>
      (u.userName || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.callerIdName || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.mac || "").toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = users.filter((u) => u.connectionState === "connected" || u.online).length;

  async function doAction(userName, action, body = null) {
    try {
      await fetch(`/api/v1/admin/users/${userName}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : null,
      });
      refetch();
    } catch (e) {
      console.error("Action failed:", e);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-mono tabular-nums">{users.length}</span> total,{" "}
          <span className="font-mono tabular-nums">{onlineCount}</span> online
        </p>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search name, caller ID, or MAC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Room</TableHead>
                <TableHead className="hidden lg:table-cell">MAC</TableHead>
                <TableHead className="hidden xl:table-cell">State</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow
                    key={user.userName}
                    className="cursor-pointer group transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setSheetOpen(true);
                    }}
                  >
                    <TableCell>
                      <span className={`inline-block size-2 rounded-full ${getStatusDot(user)}`} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.callerIdName || user.userName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {ROOM_NAMES[user.room] || user.room || "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                      {user.mac || "-"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell font-mono text-xs text-muted-foreground">
                      {user.connectionState || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {timeAgo(user.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Reconnect"
                          onClick={() => doAction(user.userName, "reconnect")}
                        >
                          <RefreshCwIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title={user.mute ? "Unmute" : "Mute"}
                          onClick={() =>
                            doAction(user.userName, user.mute ? "unmute" : "mute")
                          }
                        >
                          {user.mute ? (
                            <MicOffIcon className="size-3.5 text-destructive" />
                          ) : (
                            <MicIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Change Room"
                          onClick={() => {
                            setActionUser(user);
                            setNewRoom(user.room || "");
                            setRoomDialogOpen(true);
                          }}
                        >
                          <ArrowRightLeftIcon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedUser?.callerIdName || selectedUser?.userName}</SheetTitle>
            <SheetDescription>User details and connection info</SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-2">
                <span className={`inline-block size-2 rounded-full ${getStatusDot(selectedUser)}`} />
                <span className="text-sm font-medium text-muted-foreground">
                  {getStatusLabel(selectedUser)}
                </span>
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">User Info</p>
                <div className="grid gap-3 text-sm">
                  {[
                    { label: "Username", value: selectedUser.userName },
                    { label: "Caller ID", value: selectedUser.callerIdName },
                    { label: "Room", value: ROOM_NAMES[selectedUser.room] || selectedUser.room },
                  ].map((field) => (
                    <div key={field.label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{field.label}</span>
                      <span>{field.value || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Connection Details</p>
                <div className="grid gap-3 text-sm">
                  {[
                    { label: "MAC Address", value: selectedUser.mac, mono: true },
                    { label: "IP Address", value: selectedUser.ip, mono: true },
                    { label: "Connection", value: selectedUser.connectionState, mono: true },
                    { label: "Auth State", value: selectedUser.authState, mono: true },
                    { label: "Muted", value: selectedUser.mute ? "Yes" : "No" },
                    { label: "Created", value: formatDate(selectedUser.createdAt) },
                    { label: "Updated", value: formatDate(selectedUser.updatedAt) },
                  ].map((field) => (
                    <div key={field.label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{field.label}</span>
                      <span className={field.mono ? "font-mono text-xs" : ""}>
                        {field.value || "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => doAction(selectedUser.userName, "reconnect")}
                >
                  <RefreshCwIcon className="size-3.5 mr-2" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    doAction(selectedUser.userName, selectedUser.mute ? "unmute" : "mute")
                  }
                >
                  {selectedUser.mute ? (
                    <MicOffIcon className="size-3.5 mr-2" />
                  ) : (
                    <MicIcon className="size-3.5 mr-2" />
                  )}
                  {selectedUser.mute ? "Unmute" : "Mute"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setActionUser(selectedUser);
                    setNewRoom(selectedUser.room || "");
                    setRoomDialogOpen(true);
                  }}
                >
                  <ArrowRightLeftIcon className="size-3.5 mr-2" />
                  Room
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Room</DialogTitle>
            <DialogDescription>
              Move {actionUser?.userName} to a different conference room
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Select Room</Label>
              <Select value={newRoom} onValueChange={setNewRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_NAMES).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (actionUser && newRoom) {
                  doAction(actionUser.userName, "room", { room: newRoom });
                  setRoomDialogOpen(false);
                }
              }}
            >
              Move User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
