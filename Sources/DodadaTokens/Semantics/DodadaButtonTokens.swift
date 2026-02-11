// Generated from design tokens. Semantics reference primitives (no magic numbers).
import CoreGraphics

public struct DodadaButtonSemanticTokens {
    public let height: CGFloat
    public let paddingHorizontal: CGFloat
    public let paddingVertical: CGFloat
    public let radius: CGFloat
    public let gap: CGFloat
}

public enum DodadaButtonSize { case regular, medium, small }
public enum DodadaButtonVariant { case primary, secondary, tertiary, link, onlyIcon }

public enum DodadaButtonTokens {
    public static func semantic(size: DodadaButtonSize, variant: DodadaButtonVariant) -> DodadaButtonSemanticTokens {
        let height: CGFloat
        let paddingH: CGFloat
        let paddingV: CGFloat = DodadaSpacing.sm
        let radius = DodadaRadius.md
        let gap = DodadaSpacing.sm
        switch (size, variant) {
        case (.regular, _), (.medium, _), (.small, _) where variant != .link && variant != .onlyIcon:
            height = variant == .link ? DodadaSizing.buttonHeightLinkRegular : DodadaSizing.buttonHeightRegular
            paddingH = variant == .link ? 0 : 24
        case (_, .link):
            height = DodadaSizing.buttonHeightLinkRegular
            paddingH = 0
        case (_, .onlyIcon):
            height = DodadaSizing.buttonOnlyIconSize
            paddingH = 0
        default:
            height = DodadaSizing.buttonHeightRegular
            paddingH = 24
        }
        return DodadaButtonSemanticTokens(height: height, paddingHorizontal: paddingH, paddingVertical: paddingV, radius: radius, gap: gap)
    }
}
