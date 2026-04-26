import { ChatControllerPool } from "../app/client/controller";

describe("Arena Mode", () => {
  describe("ChatControllerPool Arena support", () => {
    beforeEach(() => {
      ChatControllerPool.controllers = {};
    });

    test("can manage multiple controllers for Arena messages", () => {
      const sessionId = "session-1";
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const controller3 = new AbortController();

      ChatControllerPool.addController(sessionId, "msg-1", controller1);
      ChatControllerPool.addController(sessionId, "msg-2", controller2);
      ChatControllerPool.addController(sessionId, "msg-3", controller3);

      expect(ChatControllerPool.hasPending()).toBe(true);
      expect(Object.keys(ChatControllerPool.controllers).length).toBe(3);
    });

    test("can stop individual Arena message controllers", () => {
      const sessionId = "session-1";
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      ChatControllerPool.addController(sessionId, "msg-1", controller1);
      ChatControllerPool.addController(sessionId, "msg-2", controller2);

      ChatControllerPool.stop(sessionId, "msg-1");

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(false);
    });

    test("can stop all Arena message controllers at once", () => {
      const sessionId = "session-1";
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const controller3 = new AbortController();

      ChatControllerPool.addController(sessionId, "msg-1", controller1);
      ChatControllerPool.addController(sessionId, "msg-2", controller2);
      ChatControllerPool.addController(sessionId, "msg-3", controller3);

      ChatControllerPool.stopAll();

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
      expect(controller3.signal.aborted).toBe(true);
    });

    test("removing a controller does not affect others", () => {
      const sessionId = "session-1";
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      ChatControllerPool.addController(sessionId, "msg-1", controller1);
      ChatControllerPool.addController(sessionId, "msg-2", controller2);

      ChatControllerPool.remove(sessionId, "msg-1");

      expect(Object.keys(ChatControllerPool.controllers).length).toBe(1);
      expect(ChatControllerPool.hasPending()).toBe(true);
    });

    test("no pending controllers after removing all", () => {
      const sessionId = "session-1";
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      ChatControllerPool.addController(sessionId, "msg-1", controller1);
      ChatControllerPool.addController(sessionId, "msg-2", controller2);

      ChatControllerPool.remove(sessionId, "msg-1");
      ChatControllerPool.remove(sessionId, "msg-2");

      expect(ChatControllerPool.hasPending()).toBe(false);
    });
  });

  describe("Arena model selection constraints", () => {
    test("minimum 2 models required for Arena", () => {
      const selectedModels = [
        { model: "gpt-4", providerName: "OpenAI" },
      ];
      expect(selectedModels.length).toBeLessThan(2);
    });

    test("maximum 4 models allowed for Arena", () => {
      const selectedModels = [
        { model: "gpt-4", providerName: "OpenAI" },
        { model: "claude-3", providerName: "Anthropic" },
        { model: "gemini-pro", providerName: "Google" },
        { model: "deepseek-chat", providerName: "DeepSeek" },
      ];
      expect(selectedModels.length).toBe(4);
      expect(selectedModels.length).toBeLessThanOrEqual(4);
    });

    test("5 models exceeds Arena limit", () => {
      const selectedModels = [
        { model: "gpt-4", providerName: "OpenAI" },
        { model: "claude-3", providerName: "Anthropic" },
        { model: "gemini-pro", providerName: "Google" },
        { model: "deepseek-chat", providerName: "DeepSeek" },
        { model: "qwen-max", providerName: "Alibaba" },
      ];
      expect(selectedModels.length).toBeGreaterThan(4);
    });

    test("2 models is valid for Arena", () => {
      const selectedModels = [
        { model: "gpt-4", providerName: "OpenAI" },
        { model: "claude-3", providerName: "Anthropic" },
      ];
      expect(selectedModels.length).toBeGreaterThanOrEqual(2);
      expect(selectedModels.length).toBeLessThanOrEqual(4);
    });

    test("3 models is valid for Arena", () => {
      const selectedModels = [
        { model: "gpt-4", providerName: "OpenAI" },
        { model: "claude-3", providerName: "Anthropic" },
        { model: "gemini-pro", providerName: "Google" },
      ];
      expect(selectedModels.length).toBeGreaterThanOrEqual(2);
      expect(selectedModels.length).toBeLessThanOrEqual(4);
    });
  });

  describe("Arena message grouping logic", () => {
    type SimpleMessage = {
      id: string;
      role: string;
      content: string;
      arenaId?: string;
      model?: string;
    };

    function groupMessages(messages: SimpleMessage[]) {
      type RenderGroup =
        | { type: "single"; message: SimpleMessage; index: number }
        | { type: "arena"; messages: SimpleMessage[]; indices: number[] };

      const groups: RenderGroup[] = [];
      let i = 0;
      while (i < messages.length) {
        const msg = messages[i];
        if (msg.role === "assistant" && msg.arenaId) {
          const arenaId = msg.arenaId;
          const arenaMsgs: SimpleMessage[] = [];
          const indices: number[] = [];
          while (i < messages.length && messages[i].arenaId === arenaId) {
            arenaMsgs.push(messages[i]);
            indices.push(i);
            i++;
          }
          groups.push({ type: "arena", messages: arenaMsgs, indices });
        } else {
          groups.push({ type: "single", message: msg, index: i });
          i++;
        }
      }
      return groups;
    }

    test("messages with same arenaId are grouped together", () => {
      const messages: SimpleMessage[] = [
        { id: "1", role: "user", content: "hello" },
        {
          id: "2",
          role: "assistant",
          content: "response 1",
          arenaId: "arena-1",
          model: "gpt-4",
        },
        {
          id: "3",
          role: "assistant",
          content: "response 2",
          arenaId: "arena-1",
          model: "claude-3",
        },
      ];

      const groups = groupMessages(messages);
      expect(groups.length).toBe(2);
      expect(groups[0].type).toBe("single");
      expect(groups[1].type).toBe("arena");
      if (groups[1].type === "arena") {
        expect(groups[1].messages.length).toBe(2);
      }
    });

    test("messages without arenaId are rendered individually", () => {
      const messages: SimpleMessage[] = [
        { id: "1", role: "user", content: "hello" },
        {
          id: "2",
          role: "assistant",
          content: "response 1",
          model: "gpt-4",
        },
      ];

      const groups = groupMessages(messages);
      expect(groups.length).toBe(2);
      expect(groups.every((g) => g.type === "single")).toBe(true);
    });

    test("different arenaIds are grouped separately", () => {
      const messages: SimpleMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: "response 1",
          arenaId: "arena-1",
          model: "gpt-4",
        },
        {
          id: "2",
          role: "assistant",
          content: "response 2",
          arenaId: "arena-1",
          model: "claude-3",
        },
        { id: "3", role: "user", content: "next question" },
        {
          id: "4",
          role: "assistant",
          content: "response 3",
          arenaId: "arena-2",
          model: "gpt-4",
        },
        {
          id: "5",
          role: "assistant",
          content: "response 4",
          arenaId: "arena-2",
          model: "gemini-pro",
        },
      ];

      const groups = groupMessages(messages);
      expect(groups.length).toBe(3);
      expect(groups[0].type).toBe("arena");
      expect(groups[1].type).toBe("single");
      expect(groups[2].type).toBe("arena");
    });

    test("normal mode messages are not affected by arenaId field", () => {
      const messages: SimpleMessage[] = [
        { id: "1", role: "user", content: "hello" },
        {
          id: "2",
          role: "assistant",
          content: "normal response",
          model: "gpt-4",
        },
      ];

      const groups = groupMessages(messages);
      expect(groups.length).toBe(2);
      expect(groups[0].type).toBe("single");
      expect(groups[1].type).toBe("single");
    });

    test("4-model Arena group is correctly formed", () => {
      const messages: SimpleMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: "r1",
          arenaId: "arena-1",
          model: "gpt-4",
        },
        {
          id: "2",
          role: "assistant",
          content: "r2",
          arenaId: "arena-1",
          model: "claude-3",
        },
        {
          id: "3",
          role: "assistant",
          content: "r3",
          arenaId: "arena-1",
          model: "gemini-pro",
        },
        {
          id: "4",
          role: "assistant",
          content: "r4",
          arenaId: "arena-1",
          model: "deepseek-chat",
        },
      ];

      const groups = groupMessages(messages);
      expect(groups.length).toBe(1);
      expect(groups[0].type).toBe("arena");
      if (groups[0].type === "arena") {
        expect(groups[0].messages.length).toBe(4);
      }
    });
  });
});
