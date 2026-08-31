import { format, formatDistanceToNow } from "date-fns";

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
