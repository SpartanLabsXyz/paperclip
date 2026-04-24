import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { issuesApi, type RunTreeNode } from "@/api/issues";
import { queryKeys } from "@/lib/queryKeys";
import { StatusIcon } from "./StatusIcon";
import { relativeTime, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, User } from "lucide-react";

interface SpawnTreeProps {
  issueId: string;
  issueStatus: string;
}

interface TreeNode extends RunTreeNode {
  children: TreeNode[];
  depth: number;
}

function buildTree(nodes: RunTreeNode[], rootId: string): TreeNode | null {
  const childrenMap = new Map<string | "root", RunTreeNode[]>();
  let rootNode: RunTreeNode | null = null;

  for (const node of nodes) {
    if (node.id === rootId) {
      rootNode = node;
    }
    const key = node.parentId ?? "root";
    const existing = childrenMap.get(key);
    if (existing) {
      existing.push(node);
    } else {
      childrenMap.set(key, [node]);
    }
  }

  if (!rootNode) return null;

  function expand(node: RunTreeNode, depth: number): TreeNode {
    const kids = childrenMap.get(node.id) ?? [];
    return {
      ...node,
      depth,
      children: kids.map((k) => expand(k, depth + 1)),
    };
  }

  return expand(rootNode, 0);
}

function TreeNodeRow({ node, focusId }: { node: TreeNode; focusId: string }) {
  const isFocused = node.id === focusId;
  const linkPath = node.identifier ? `/issues/${node.identifier}` : `/issues/${node.id}`;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md text-sm",
          isFocused && "bg-accent/50 ring-1 ring-accent",
        )}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
      >
        <StatusIcon status={node.status} className="shrink-0" />
        <Link
          to={linkPath}
          className="font-medium truncate hover:underline"
        >
          {node.identifier && (
            <span className="text-muted-foreground mr-1.5">{node.identifier}</span>
          )}
          <span>{node.title}</span>
        </Link>
        {node.assigneeAgentName && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <User className="h-3 w-3" />
            {node.assigneeAgentName}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {node.startedAt
            ? node.completedAt
              ? `${relativeTime(node.startedAt)} - ${relativeTime(node.completedAt)}`
              : `started ${relativeTime(node.startedAt)}`
            : `created ${relativeTime(node.createdAt)}`}
        </span>
      </div>
      {node.children.map((child) => (
        <TreeNodeRow key={child.id} node={child} focusId={focusId} />
      ))}
    </div>
  );
}

export function SpawnTree({ issueId, issueStatus }: SpawnTreeProps) {
  const isActive = issueStatus === "in_progress" || issueStatus === "in_review";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.issues.runTree(issueId),
    queryFn: () => issuesApi.runTree(issueId),
    enabled: !!issueId,
    refetchInterval: isActive ? 5000 : false,
    placeholderData: keepPreviousData,
  });

  const tree = useMemo(() => {
    if (!data?.nodes?.length || !data.rootId) return null;
    return buildTree(data.nodes, data.rootId);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!tree || data!.nodes.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <GitBranch className="h-6 w-6" />
        <p className="text-sm">No spawn tree — this issue has no parent or child issues.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <TreeNodeRow node={tree} focusId={data!.focusId} />
    </div>
  );
}
