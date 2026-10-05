import { PlanImages, planImageSource } from "../PlanImages";

describe("planImageSource", () => {
  it("resolves every picker image to a bundled asset", () => {
    for (const url of Object.values(PlanImages)) {
      expect(planImageSource(url)).not.toEqual({ uri: url });
    }
  });

  it("resolves a premade plan URL whatever its query string", () => {
    const url =
      "https://images.unsplash.com/photo-1647456788971-90ac7066de4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
    expect(planImageSource(url)).not.toEqual({ uri: url });
  });

  it("falls back to the URI for an unknown Unsplash photo", () => {
    const url = "https://images.unsplash.com/photo-1111111111111-aaaaaaaaaaaa";
    expect(planImageSource(url)).toEqual({ uri: url });
  });

  it("falls back to the URI for a device photo", () => {
    const url = "file:///data/user/0/app/cache/ImagePicker/abc.jpg";
    expect(planImageSource(url)).toEqual({ uri: url });
  });
});
