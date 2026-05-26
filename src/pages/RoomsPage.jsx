import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { ROOM_NAMES } from "@/lib/constants";
import { Volume2Icon } from "lucide-react";

const MAX_CAPACITY = 500;

export default function RoomsPage() {
  const { data, loading, refetch } = useFetch("/api/v1/admin/rooms");
  useSSERefresh(refetch, ["rooms", "users"]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function honk(roomId) {
    try {
      await fetch(`/api/v1/admin/rooms/${roomId}/honk`, { method: "POST" });
    } catch (e) {
      console.error("Honk failed:", e);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(12)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-28 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const rooms = Array.isArray(data)
    ? data
    : Object.keys(ROOM_NAMES).map((id) => ({
        roomId: id,
        members: [],
        totalMembers: 0,
        onlineMembers: 0,
        activeSpeakers: 0,
      }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Conference Rooms</h2>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-mono tabular-nums">{rooms.length}</span> rooms,{" "}
          <span className="font-mono tabular-nums">
            {rooms.reduce((s, r) => s + (r.onlineMembers ?? 0), 0)}
          </span>{" "}
          total online
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const memberCount = room.totalMembers ?? room.members?.length ?? 0;
          const online = room.onlineMembers ?? 0;
          const speakers = room.activeSpeakers ?? 0;
          const muted = memberCount - (room.unmuted ?? speakers);
          const isEmpty = online === 0;
          const capacityPct = Math.min((memberCount / MAX_CAPACITY) * 100, 100);

          return (
            <Card
              key={room.roomId}
              className={`cursor-pointer transition-all hover:border-blue-500/30 ${isEmpty ? "border-dashed opacity-50 hover:opacity-75" : ""}`}
              onClick={() => {
                setSelectedRoom(room);
                setDialogOpen(true);
              }}
            >
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold">
                    {ROOM_NAMES[room.roomId] || room.roomId}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {memberCount}/{MAX_CAPACITY}
                  </span>
                </div>

                {isEmpty ? (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No members
                  </p>
                ) : (
                  <>
                    <p className="text-4xl font-mono font-bold tabular-nums text-center my-4">
                      {memberCount}
                    </p>
                    <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-green-500" />
                        {online} Online
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-blue-500" />
                        {speakers} Speaking
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-yellow-500" />
                        {muted > 0 ? muted : 0} Muted
                      </span>
                    </div>
                    <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    honk(room.roomId);
                  }}
                >
                  <Volume2Icon className="size-3.5 mr-2" />
                  Honk
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {ROOM_NAMES[selectedRoom?.roomId] || selectedRoom?.roomId}
            </DialogTitle>
            <DialogDescription>
              {(selectedRoom?.members || []).length} members assigned to this room
            </DialogDescription>
          </DialogHeader>
          {selectedRoom && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Muted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedRoom.members || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No members in this room
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedRoom.members.map((m) => (
                    <TableRow key={m.userName || m.user_name}>
                      <TableCell>
                        <span
                          className={`inline-block size-2 rounded-full ${
                            m.online ? "bg-green-500" : "bg-zinc-500"
                          }`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {m.userName || m.user_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.mute ? "Muted" : "Active"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
