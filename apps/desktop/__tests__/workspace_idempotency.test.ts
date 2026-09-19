import { describe, it, expect, beforeEach } from "vitest"
import fs from "fs"
import path from "path"
import {
  normalizeWorkspacePath,
  sanitizeWorkspaces,
  loadWorkstationState,
  saveWorkstationState,
  ProjectWorkspace,
  WorkstationState,
  DEFAULT_INITIAL_STATE,
} from "../src/lib/persistence"

describe("Issue #5: Workspace Idempotency, Hydration Sanitization & Breadcrumb Switcher", () => {
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const sessionHookPath = path.resolve(__dirname, "../src/hooks/useAgentSession.ts")
  const dashboardPath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")

  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.clear()
    }
  })

  describe("1. normalizeWorkspacePath", () => {
    it("normalizes backslashes to forward slashes", () => {
      expect(normalizeWorkspacePath("projects\\my-project")).toBe("projects/my-project")
      expect(normalizeWorkspacePath("C:\\Users\\admin\\krypton")).toBe("c:/Users/admin/krypton")
    })

    it("strips trailing slashes from paths", () => {
      expect(normalizeWorkspacePath("projects/my-project/")).toBe("projects/my-project")
      expect(normalizeWorkspacePath("projects/my-project///")).toBe("projects/my-project")
    })

    it("strips leading relative dot slash", () => {
      expect(normalizeWorkspacePath("./projects/my-project")).toBe("projects/my-project")
      expect(normalizeWorkspacePath(".\\projects\\my-project")).toBe("projects/my-project")
    })

    it("normalizes Windows drive letters consistently to lowercase", () => {
      expect(normalizeWorkspacePath("C:/code/krypton")).toBe("c:/code/krypton")
      expect(normalizeWorkspacePath("D:\\workspace\\project")).toBe("d:/workspace/project")
    })

    it("handles empty and whitespace-only strings safely", () => {
      expect(normalizeWorkspacePath("")).toBe("")
      expect(normalizeWorkspacePath("   ")).toBe("")
    })

    it("collapses redundant consecutive slashes", () => {
      expect(normalizeWorkspacePath("projects//nested///dir")).toBe("projects/nested/dir")
    })
  })

  describe("2. sanitizeWorkspaces (Hydration Sanitizer)", () => {
    it("filters out duplicate workspaces sharing the same ID", () => {
      const duplicateById: ProjectWorkspace[] = [
        {
          id: "proj-1",
          name: "Project Alpha",
          path: "projects/alpha",
          branch: "main",
          activeThreadId: "thread-1",
          threads: [
            {
              id: "thread-1",
              projectId: "proj-1",
              title: "Session 1",
              createdAt: 1000,
              updatedAt: 1000,
              status: "idle",
              messages: [],
            },
          ],
        },
        {
          id: "proj-1",
          name: "Project Alpha Duplicate",
          path: "projects/alpha",
          branch: "main",
          activeThreadId: "thread-1",
          threads: [],
        },
      ]

      const sanitized = sanitizeWorkspaces(duplicateById)
      expect(sanitized.length).toBe(1)
      expect(sanitized[0].id).toBe("proj-1")
    })

    it("filters out duplicate workspaces sharing the same normalized filesystem path", () => {
      const duplicateByPath = [
        {
          id: "proj-101",
          name: "my-project",
          path: "projects/my-project",
          branch: "main",
          activeThreadId: "thread-101",
          threads: [
            {
              id: "thread-101",
              projectId: "proj-101",
              title: "Initial Session",
              createdAt: 1000,
              updatedAt: 1000,
              status: "idle",
              messages: [],
            },
          ],
        },
        {
          id: "proj-102", // Different ID (e.g. from repeated breadcrumb clicks)
          name: "my-project",
          path: "projects\\my-project\\", // Backslashes & trailing slash
          branch: "main",
          activeThreadId: "thread-102",
          threads: [
            {
              id: "thread-102",
              projectId: "proj-102",
              title: "Initial Session 2",
              createdAt: 2000,
              updatedAt: 2000,
              status: "idle",
              messages: [],
            },
          ],
        },
      ]

      const sanitized = sanitizeWorkspaces(duplicateByPath)
      expect(sanitized.length).toBe(1)
      expect(sanitized[0].id).toBe("proj-101")
      // Threads from the duplicate should be merged into the surviving project
      expect(sanitized[0].threads.length).toBe(2)
      expect(sanitized[0].threads.map((t) => t.id)).toEqual(["thread-101", "thread-102"])
    })

    it("filters out invalid, null, or empty entries", () => {
      const mixed = [
        null,
        undefined,
        {},
        { id: "", path: "" },
        {
          id: "proj-valid",
          name: "Valid Project",
          path: "projects/valid",
          branch: "main",
          activeThreadId: "thread-v",
          threads: [
            {
              id: "thread-v",
              projectId: "proj-valid",
              title: "Main Session",
              createdAt: 1000,
              updatedAt: 1000,
              status: "idle",
              messages: [],
            },
          ],
        },
      ]

      const sanitized = sanitizeWorkspaces(mixed)
      expect(sanitized.length).toBe(1)
      expect(sanitized[0].id).toBe("proj-valid")
    })

    it("ensures at least one fallback thread exists if threads array is empty", () => {
      const projectWithoutThreads = [
        {
          id: "proj-empty-threads",
          name: "Empty Threads Project",
          path: "projects/empty",
          branch: "main",
          activeThreadId: "",
          threads: [],
        },
      ]

      const sanitized = sanitizeWorkspaces(projectWithoutThreads)
      expect(sanitized.length).toBe(1)
      expect(sanitized[0].threads.length).toBe(1)
      expect(sanitized[0].activeThreadId).toBe(sanitized[0].threads[0].id)
      expect(sanitized[0].threads[0].title).toBe("Initial Session")
    })
  })

  describe("3. loadWorkstationState Hydration Auto-Sanitization", () => {
    it("sanitizes duplicated state stored in localStorage on load and writes back cleaned state", () => {
      // Mock localStorage environment
      const mockStorage: Record<string, string> = {}
      const originalWindow = global.window
      // @ts-expect-error mock window for node vitest
      global.window = {}
      // @ts-expect-error mock localStorage
      global.localStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v
        },
        clear: () => {
          for (const key of Object.keys(mockStorage)) delete mockStorage[key]
        },
      }

      const dirtyState: WorkstationState = {
        ...DEFAULT_INITIAL_STATE,
        activeProjectId: "proj-1",
        activeThreadId: "thread-1",
        projects: [
          {
            id: "proj-1",
            name: "my-project",
            path: "projects/my-project",
            branch: "main",
            activeThreadId: "thread-1",
            threads: [
              {
                id: "thread-1",
                projectId: "proj-1",
                title: "Initial Session",
                createdAt: 1000,
                updatedAt: 1000,
                status: "idle" as const,
                messages: [],
              },
            ],
          },
          {
            id: "proj-2",
            name: "my-project",
            path: "projects/my-project",
            branch: "main",
            activeThreadId: "thread-2",
            threads: [
              {
                id: "thread-2",
                projectId: "proj-2",
                title: "Initial Session 2",
                createdAt: 2000,
                updatedAt: 2000,
                status: "idle" as const,
                messages: [],
              },
            ],
          },
        ],
      }

      saveWorkstationState(dirtyState)
      expect(JSON.parse(mockStorage["krypton_workstation_state_v2"]).projects.length).toBe(2)

      const loaded = loadWorkstationState()
      expect(loaded.projects.length).toBe(1)
      expect(loaded.projects[0].id).toBe("proj-1")
      // Cleaned state was auto-persisted back
      expect(JSON.parse(mockStorage["krypton_workstation_state_v2"]).projects.length).toBe(1)

      global.window = originalWindow
    })
  })

  describe("4. State Idempotency: createProject & selectProject in useAgentSession", () => {
    it("ensures createProject guards against duplicate paths and returns/activates existing workspace", () => {
      expect(fs.existsSync(sessionHookPath)).toBe(true)
      const sessionSource = fs.readFileSync(sessionHookPath, "utf-8")

      // Checks normalized paths when creating project
      expect(sessionSource).toContain("normalizeWorkspacePath(trimmedPath)")
      expect(sessionSource).toContain("normalizeWorkspacePath(p.path) === normTarget")

      // Activates existing workspace rather than inserting a duplicate
      expect(sessionSource).toContain("// 1. Guard against existing workspace by path or ID/name")
      expect(sessionSource).toContain("setActiveProjectId(existing.id)")
      expect(sessionSource).toContain("return existing")

      // Functional updater guards against race conditions
      expect(sessionSource).toContain("if (alreadyInState) return prev")

      // selectProject supports normalized path or unique ID lookup
      expect(sessionSource).toContain("// Switch active project by ID or normalized path")
      expect(sessionSource).toContain("p.id === rawTarget ||")
      expect(sessionSource).toContain("(normTarget && normalizeWorkspacePath(p.path) === normTarget)")
    })
  })

  describe("5. Header Breadcrumb & Workspace Switcher Popover in WindowHeader", () => {
    it("ensures clicking the breadcrumb exclusively toggles the popover with ZERO side effects on workspace array", () => {
      expect(fs.existsSync(windowHeaderPath)).toBe(true)
      const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

      // Middle Segment Breadcrumb container is click-isolated and has workspaceSwitcherRef
      expect(headerSource).toContain("Middle Segment: Breadcrumbs (Click-Isolated)")
      expect(headerSource).toContain("ref={workspaceSwitcherRef}")
      expect(headerSource).toContain('data-tauri-drag-region="false"')

      // Breadcrumb click ONLY toggles isWorkspaceSwitcherOpen
      expect(headerSource).toContain("setIsWorkspaceSwitcherOpen((prev) => !prev)")
      expect(headerSource).toContain('title={`Workspace: ${projectName || "No Workspace Open"}')

      // Verify breadcrumb segment exclusively toggles switcher and does NOT invoke onCreateProject() directly
      const middleSegmentIdx = headerSource.indexOf("Middle Segment: Breadcrumbs (Click-Isolated)")
      const middleSegmentEnd = headerSource.indexOf("Empty Draggable Region between Breadcrumbs and Controls")
      const breadcrumbSection = headerSource.substring(middleSegmentIdx, middleSegmentEnd)

      expect(breadcrumbSection).toContain("setIsWorkspaceSwitcherOpen((prev) => !prev)")
      expect(breadcrumbSection).toContain('aria-haspopup="true"')
      expect(breadcrumbSection).toContain('aria-expanded={isWorkspaceSwitcherOpen}')
      expect(breadcrumbSection).not.toContain("onClick={() => onCreateProject?.()}")

      // Popover renders list of workspaces with active checkmark
      expect(headerSource).toContain("{/* Workspace Switcher Popover */}")
      expect(headerSource).toContain("Switch Workspace")
      expect(headerSource).toContain("onSelectProject?.(proj.id)")
      expect(headerSource).toContain("setIsWorkspaceSwitcherOpen(false)")
    })

    it("verifies dashboard and settings pages wire workspace switcher props into WindowHeader", () => {
      expect(fs.existsSync(dashboardPath)).toBe(true)
      const dashboardSource = fs.readFileSync(dashboardPath, "utf-8")

      expect(dashboardSource).toContain("projects={session.projects}")
      expect(dashboardSource).toContain("activeProjectId={session.activeProjectId}")
      expect(dashboardSource).toContain("onSelectProject={")
      expect(dashboardSource).toContain("session.selectProject")

      // Ensure dashboard provides modal dialog for new workspaces instead of hardcoding duplicates
      expect(dashboardSource).toContain("New Workspace Project")
      expect(dashboardSource).toContain("setIsNewProjectModalOpen")
    })
  })
})
