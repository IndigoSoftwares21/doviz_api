import normaliseTag from "@/utils/ziktags/normaliseTag";
import tagFormatProblem from "@/utils/ziktags/tagFormatProblem";
import tagCandidates from "@/utils/ziktags/tagCandidates";

describe("normaliseTag", () => {
    it("trims, drops one leading @ and lowercases", () => {
        expect(normaliseTag({ value: "  @Ada_O " })).toBe("ada_o");
        expect(normaliseTag({ value: "@@ada" })).toBe("@ada"); // only one — the second @ makes it invalid
    });
});

describe("tagFormatProblem", () => {
    it.each(["ada", "ada_o", "a12", "tunde_2026", "abcdefghijklmnopqrst"])("accepts %s", (tag) => {
        expect(tagFormatProblem({ tag })).toBeNull();
    });

    it.each(["ab", "1ada", "_ada", "ada-o", "ada.o", "abcdefghijklmnopqrstu", "@ada", "ada o", "adé"])("rejects %s as invalid", (tag) => {
        expect(tagFormatProblem({ tag })).toBe("invalid");
    });

    it.each(["ziks", "admin", "you", "everyone", "wallet", "null"])("reserves the exact word %s", (tag) => {
        expect(tagFormatProblem({ tag })).toBe("reserved");
    });

    it.each(["ziks_support", "zikspay", "adminfaith", "help_desk_ng", "pay_support", "ng_admin", "officialtunde", "verify_me", "refund_ng", "teamada", "security1"])(
        "blocks the official-sounding %s",
        (tag) => expect(tagFormatProblem({ tag })).toBe("reserved"),
    );

    it("blocks offensive words anywhere, even split by underscores", () => {
        expect(tagFormatProblem({ tag: "big_shit_ng" })).toBe("reserved");
        expect(tagFormatProblem({ tag: "fu_ck_ng" })).toBe("reserved");
    });

    it("doesn't block names that merely contain an official word in the middle", () => {
        expect(tagFormatProblem({ tag: "chiadmina" })).toBeNull(); // "admin" inside, not at either end
    });
});

describe("tagCandidates", () => {
    const seed = () => 0.5; // numbers → 550

    it("builds well-formed ideas from a name, best first, accents dropped", () => {
        const ideas = tagCandidates({ firstName: "Adéṣọlá", lastName: "Okafor-Eze", seed });
        expect(ideas.slice(0, 4)).toEqual(["adesolaokaforeze", "adesola_okaforeze", "adesola_o", "okaforezeadesola"]);
        ideas.forEach((tag) => expect(tagFormatProblem({ tag })).toBeNull());
    });

    it("uses one name when that's all there is, and a user123-style fallback with none", () => {
        expect(tagCandidates({ firstName: "Tunde", lastName: null, seed })[0]).toBe("tunde");
        const fallback = tagCandidates({ firstName: null, lastName: null, seed });
        expect(fallback.length).toBeGreaterThan(0);
        fallback.forEach((tag) => {
            expect(tagFormatProblem({ tag })).toBeNull();
            expect(tag.startsWith("ziks")).toBe(false);
        });
    });

    it("never suggests something reserved or official-sounding", () => {
        tagCandidates({ firstName: "Admin", lastName: "Support", seed }).forEach((tag) => expect(tagFormatProblem({ tag })).toBeNull());
    });

    it("keeps long names within 20 characters", () => {
        tagCandidates({ firstName: "Oluwatobilobaayomide", lastName: "Adebayo", seed }).forEach((tag) => expect(tag.length).toBeLessThanOrEqual(20));
    });
});
